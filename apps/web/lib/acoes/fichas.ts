"use server";
/**
 * Contracheques e fichas financeiras em PDF: o arquivo é lido na memória e descartado. Só os dados extraídos
 * vão para a tela de revisão e, depois de confirmados, para o banco (decisão de 19/10/2026: nada de guardar os PDFs).
 */
import { aplicarCorrespondencia, lerDocumentoPdf, type Correspondencia, type FichaFinanceira } from "@painel-ea/leitor-ficha";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dadosDoFavorecido, fichaValida, periodoDosDocumentos, type DadosLidos, type DocumentoExtraido } from "@/lib/favorecido";
import { omParaNovoProcesso } from "@/lib/processo";
import { sessao } from "@/lib/sessao";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

export interface ResumoDocumento {
  arquivo: string;
  tipo: "contracheque" | "ficha";
  /** "Agosto/2026" (contracheque) ou "2025" (ficha) */
  referencia: string;
  linhas: number;
  conferenciaOk: boolean;
  avisos: string[];
}
export interface Previa {
  erro?: string;
  /** Dados lidos (sem os arquivos), devolvidos ao servidor ao gravar. */
  documentos?: DocumentoExtraido[];
  resumo?: ResumoDocumento[];
  /** Diferenças entre o cabeçalho dos documentos e o cadastro do militar. */
  divergenciasMilitar?: string[];
  dados?: DadosLidos;
  lancamentos?: { ano: number; mes: number; posicao: number; valor: number }[];
  naoUsadas?: { ano: number; codigo: string; descricao: string; natureza: string; total: number }[];
  /** "2025" ou "08/2026": o que será substituído nos valores recebidos ao gravar. */
  cobertura?: string[];
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

async function tabelaCorrespondencia(supabase: Supabase): Promise<Correspondencia[]> {
  const { data } = await supabase.from("correspondencia_rubrica").select("codigo_rubrica, codigo_sippes");
  return (data ?? []).map((c) => ({ codigoRubrica: c.codigo_rubrica, codigoSippes: c.codigo_sippes }));
}

/** Lê os PDFs do formulário (campo "documentos"), reconhecendo contracheque ou ficha. Nada é guardado. */
async function lerArquivos(form: FormData): Promise<DocumentoExtraido[]> {
  const arquivos = form.getAll("documentos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!arquivos.length) throw new Error("Selecione pelo menos um PDF.");
  const lidos: DocumentoExtraido[] = [];
  for (const a of arquivos) {
    if (!a.name.toLowerCase().endsWith(".pdf")) throw new Error(`${a.name} não é PDF.`);
    let doc;
    try {
      doc = await lerDocumentoPdf(new Uint8Array(await a.arrayBuffer()));
    } catch {
      throw new Error(`Não foi possível ler ${a.name}. Envie o contracheque ou a Ficha Financeira em PDF, como baixados do sistema.`);
    }
    if (!doc.ficha.linhas.length) throw new Error(`${a.name}: não encontrei as linhas de pagamento.`);
    if (!doc.ficha.ano) throw new Error(`${a.name}: não encontrei o ano/mês de referência.`);
    lidos.push({ arquivo: a.name, tipo: doc.tipo, ficha: doc.ficha, contracheque: doc.tipo === "contracheque" ? doc.contracheque : undefined });
  }
  const cpfs = new Set(lidos.map((l) => soDigitos(l.ficha.cabecalho.cpf)).filter(Boolean));
  if (cpfs.size > 1) throw new Error("Os documentos enviados são de militares diferentes (CPFs diferentes).");
  return lidos;
}

const resumir = (d: DocumentoExtraido): ResumoDocumento => ({
  arquivo: d.arquivo, tipo: d.tipo,
  referencia: d.contracheque?.mes ? `${MESES[d.contracheque.mes - 1]}/${d.ficha.ano}` : String(d.ficha.ano),
  linhas: d.ficha.linhas.length, conferenciaOk: d.ficha.conferencias.ok, avisos: d.ficha.avisos,
});

/** Meses que cada documento substitui nos recebidos: a ficha, o ano inteiro; o contracheque, só o mês dele. */
function mesesCobertos(docs: DocumentoExtraido[]): { ano: number; meses: number[] }[] {
  const porAno = new Map<number, Set<number>>();
  for (const d of docs) {
    const ano = d.ficha.ano!;
    const s = porAno.get(ano) ?? new Set<number>();
    for (const m of d.contracheque?.mes ? [d.contracheque.mes] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) s.add(m);
    porAno.set(ano, s);
  }
  return [...porAno].sort(([a], [b]) => a - b).map(([ano, s]) => ({ ano, meses: [...s].sort((a, b) => a - b) }));
}
const descreverCobertura = (c: { ano: number; meses: number[] }[]) =>
  c.flatMap(({ ano, meses }) => (meses.length === 12 ? [String(ano)] : meses.map((m) => `${String(m).padStart(2, "0")}/${ano}`)));

function compararMilitar(docs: DocumentoExtraido[], m: Record<string, string | null>) {
  const d = new Set<string>();
  for (const { ficha: { cabecalho: cab } } of docs) {
    if (m.nome && cab.nome && m.nome.trim().toUpperCase() !== cab.nome.trim().toUpperCase()) d.add("nome");
    if (m.cpf && cab.cpf && soDigitos(m.cpf) !== soDigitos(cab.cpf)) d.add("CPF");
    if (m.prec_cp && cab.precCp && soDigitos(m.prec_cp) !== soDigitos(cab.precCp)) d.add("Prec-CP");
    if (m.identidade && cab.identidade && soDigitos(m.identidade) !== soDigitos(cab.identidade)) d.add("identidade");
  }
  return [...d];
}

async function montarPrevia(supabase: Supabase, processoId: string, docs: DocumentoExtraido[]): Promise<Previa> {
  const [{ data: processo }, { data: rubricas }] = await Promise.all([
    supabase.from("processo").select("id, situacao, militar:militar_id(nome, cpf, prec_cp, identidade)").eq("id", processoId).single(),
    supabase.from("processo_rubrica").select("posicao, codigo").eq("processo_id", processoId),
  ]);
  if (!processo) return { erro: "Processo não encontrado." };
  if (processo.situacao !== "rascunho") return { erro: "Processo já emitido. Reabra na aba Impressão para alterar." };
  const r = aplicarCorrespondencia(docs.map((d) => d.ficha), rubricas ?? [], await tabelaCorrespondencia(supabase));
  return {
    documentos: docs, resumo: docs.map(resumir), dados: dadosDoFavorecido(docs),
    divergenciasMilitar: compararMilitar(docs, (processo.militar ?? {}) as unknown as Record<string, string | null>),
    lancamentos: r.lancamentos.map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor })),
    naoUsadas: r.naoUsadas.map(({ ano, codigo, descricao, natureza, total }) => ({ ano, codigo, descricao, natureza, total })),
    cobertura: descreverCobertura(mesesCobertos(docs)),
  };
}

/** Envia contracheques e/ou fichas de um processo e devolve a prévia (nada é gravado ainda). */
export async function analisarDocumentos(processoId: string, _: Previa | undefined, form: FormData): Promise<Previa> {
  try {
    const { supabase } = await sessao();
    return await montarPrevia(supabase, processoId, await lerArquivos(form));
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Grava os recebidos: substitui os meses cobertos pelos documentos (ano inteiro da ficha; o mês do contracheque). */
async function gravarRecebidosDe(supabase: Supabase, processoId: string, docs: DocumentoExtraido[], escolhasExtras: Record<string, number>) {
  const fichas: FichaFinanceira[] = docs.map((d) => d.ficha);
  if (!fichas.length || !fichas.every(fichaValida)) throw new Error("Dados dos documentos inválidos. Envie os PDFs de novo.");
  const { data: rubricas } = await supabase.from("processo_rubrica").select("posicao, codigo").eq("processo_id", processoId);
  const r = aplicarCorrespondencia(fichas, rubricas ?? [], await tabelaCorrespondencia(supabase), escolhasExtras);
  const cobertura = mesesCobertos(docs);
  for (const { ano, meses } of cobertura) {
    const { error } = await supabase.from("lancamento").delete()
      .match({ processo_id: processoId, tipo: "recebido", ano }).in("mes", meses);
    if (error) throw new Error(error.message);
  }
  if (r.lancamentos.length) {
    const { error } = await supabase.from("lancamento").upsert(r.lancamentos.map((l) => ({
      processo_id: processoId, tipo: "recebido", ano: l.ano, mes: l.mes, posicao: l.posicao, valor: l.valor, origem: "pdf", documento_id: null,
    })));
    if (error) throw new Error(error.message);
  }
  return { ok: true as const, gravados: r.lancamentos.length, cobertura: descreverCobertura(cobertura) };
}

/** Confirma a prévia: grava os valores recebidos a partir dos dados lidos (os PDFs já foram descartados). */
export async function gravarRecebidos(processoId: string, docs: DocumentoExtraido[], escolhasExtras: Record<string, number>) {
  try {
    const { supabase } = await sessao();
    const { data: p } = await supabase.from("processo").select("situacao").eq("id", processoId).maybeSingle();
    if (p?.situacao !== "rascunho") return { erro: "Processo já emitido. Reabra na aba Impressão para alterar." };
    const r = await gravarRecebidosDe(supabase, processoId, docs, escolhasExtras);
    revalidatePath(`/processos/${processoId}`, "layout");
    return r;
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Novo processo pelos documentos: cria militar e processo com os dados lidos e já grava os recebidos. */
export async function criarProcessoDeDocumentos(_: { erro?: string } | undefined, form: FormData): Promise<{ erro?: string }> {
  let destino: string;
  try {
    const { supabase, perfil } = await sessao();
    const omId = await omParaNovoProcesso(supabase, perfil, String(form.get("om_id") ?? "") || null);
    const docs = await lerArquivos(form);
    const periodo = periodoDosDocumentos(docs);
    if (!periodo) return { erro: "Os documentos não têm valores." };
    const dados = dadosDoFavorecido(docs);
    const { data: m, error: e1 } = await supabase.from("militar").insert({
      om_id: omId, nome: dados.nome ?? "(nome não lido)", posto_graduacao: dados.posto_graduacao ?? null, prec_cp: dados.prec_cp ?? null,
      identidade: dados.identidade ?? null, cpf: dados.cpf ?? null, om_vinculacao: dados.om_vinculacao ?? null,
      banco: dados.banco ?? null, agencia: dados.agencia ?? null, conta: dados.conta ?? null,
    }).select("id").single();
    if (e1) return { erro: e1.message };
    const { data: p, error: e2 } = await supabase.from("processo").insert({
      om_id: omId, militar_id: m.id, periodo_inicio: periodo.inicio, periodo_fim: periodo.fim,
    }).select("id").single();
    if (e2) return { erro: e2.message };
    const { data: padrao } = await supabase.from("rubrica_padrao").select("posicao, codigo, tipo").order("posicao");
    const { error: e3 } = await supabase.from("processo_rubrica").insert((padrao ?? []).map((r) => ({ ...r, processo_id: p.id })));
    if (e3) return { erro: e3.message };
    await gravarRecebidosDe(supabase, p.id, docs, {});
    destino = `/processos/${p.id}/dados?importado=1`;
  } catch (e) {
    return { erro: (e as Error).message };
  }
  redirect(destino);
}
