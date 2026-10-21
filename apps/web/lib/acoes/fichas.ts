"use server";
/**
 * Contracheques e fichas financeiras em PDF: o arquivo é lido na memória e descartado. Só os dados extraídos
 * vão para a tela de revisão e, depois de confirmados, para o banco (decisão de 19/10/2026: nada de guardar os PDFs).
 */
import { aplicarCorrespondencia, lerDocumentosPdf, type Correspondencia, type FichaFinanceira } from "@painel-ea/leitor-ficha";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dadosDoFavorecido, fichaValida, periodoDosDocumentos, type DadosLidos, type DocumentoExtraido } from "@/lib/favorecido";
import { inserirRubricasIniciais, omParaNovoProcesso } from "@/lib/processo";
import { sessao } from "@/lib/sessao";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

export interface ResumoDocumento {
  arquivo: string;
  tipo: "contracheque" | "ficha";
  sistema: "sippes" | "siappes";
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
    let docs;
    try {
      docs = await lerDocumentosPdf(new Uint8Array(await a.arrayBuffer()));
    } catch {
      throw new Error(`Não foi possível ler ${a.name}. Envie o contracheque ou a Ficha Financeira (SIPPES ou SIAPPES) em PDF, como baixados do sistema.`);
    }
    // o contracheque serve só para os dados bancários: é isso que precisa estar nele
    const [cc] = docs;
    if (cc?.tipo === "contracheque") {
      const c = cc.contracheque.cabecalho;
      if (!c.banco && !c.conta) throw new Error(`${a.name}: não encontrei os dados bancários (banco, agência e conta).`);
      lidos.push({ arquivo: a.name, tipo: "contracheque", ficha: cc.ficha, contracheque: cc.contracheque });
      continue;
    }
    if (!docs.length || docs.every((d) => !d.ficha.linhas.length)) throw new Error(`${a.name}: não encontrei as linhas de pagamento.`);
    for (const doc of docs) {
      if (!doc.ficha.ano) throw new Error(`${a.name}: não encontrei o ano/mês de referência.`);
      // a ficha do SIAPPES traz vários anos: cada ano vira um documento, identificado pelo ano
      const arquivo = docs.length > 1 ? `${a.name} (${doc.ficha.ano})` : a.name;
      if (doc.ficha.linhas.length) lidos.push({ arquivo, tipo: doc.tipo, ficha: doc.ficha, contracheque: doc.tipo === "contracheque" ? doc.contracheque : undefined });
    }
  }
  // o mesmo ano em duas fichas somaria os valores duas vezes
  const anosFicha = lidos.filter((l) => l.tipo === "ficha").map((l) => l.ficha.ano);
  const repetido = anosFicha.find((ano, i) => anosFicha.indexOf(ano) !== i);
  if (repetido) throw new Error(`A ficha financeira de ${repetido} foi enviada mais de uma vez.`);
  const cpfs = new Set(lidos.map((l) => soDigitos(l.ficha.cabecalho.cpf)).filter(Boolean));
  if (cpfs.size > 1) throw new Error("Os documentos enviados são de militares diferentes (CPFs diferentes).");
  return lidos;
}

/** Só as fichas financeiras entram nos valores recebidos: o contracheque serve para os dados bancários. */
const fichasDoCalculo = (docs: DocumentoExtraido[]): FichaFinanceira[] => docs.filter((d) => d.tipo === "ficha").map((d) => d.ficha);

/** O que volta da tela de revisão: as fichas são conferidas; o contracheque não entra nos valores. */
const documentoValido = (d: DocumentoExtraido) => d.tipo === "contracheque" || fichaValida(d.ficha);

const resumir = (d: DocumentoExtraido): ResumoDocumento => ({
  arquivo: d.arquivo, tipo: d.tipo, sistema: d.ficha.sistema ?? "sippes",
  referencia: d.tipo === "ficha" ? String(d.ficha.ano) : d.contracheque?.mes ? `${MESES[d.contracheque.mes - 1]}/${d.ficha.ano}` : "(mês não lido)",
  linhas: d.ficha.linhas.length, conferenciaOk: d.ficha.conferencias.ok,
  avisos: d.tipo === "contracheque" ? ["Usado só para os dados bancários (os valores vêm das fichas)."] : d.ficha.avisos,
});

/** Meses que os documentos substituem nos recebidos: o ano inteiro de cada ficha (o contracheque não entra nos valores). */
function mesesCobertos(docs: DocumentoExtraido[]): { ano: number; meses: number[] }[] {
  const anos = [...new Set(fichasDoCalculo(docs).map((f) => f.ano!))].sort((a, b) => a - b);
  return anos.map((ano) => ({ ano, meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }));
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
  const r = aplicarCorrespondencia(fichasDoCalculo(docs), rubricas ?? [], await tabelaCorrespondencia(supabase));
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

/**
 * Recalcula a prévia com os documentos que sobraram (quando o usuário remove um lido por engano).
 * Os PDFs já foram descartados: usa os dados lidos que voltam da tela, conferindo a forma de cada ficha.
 */
export async function reanalisarDocumentos(processoId: string, docs: DocumentoExtraido[]): Promise<Previa> {
  try {
    if (!docs.length) return {};
    if (!docs.every(documentoValido)) return { erro: "Dados dos documentos inválidos. Envie os PDFs de novo." };
    const { supabase } = await sessao();
    return await montarPrevia(supabase, processoId, docs);
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Grava os recebidos: substitui os anos cobertos pelas fichas financeiras. */
async function gravarRecebidosDe(supabase: Supabase, processoId: string, docs: DocumentoExtraido[], escolhasExtras: Record<string, number>) {
  if (!docs.length || !docs.every(documentoValido)) throw new Error("Dados dos documentos inválidos. Envie os PDFs de novo.");
  const { data: rubricas } = await supabase.from("processo_rubrica").select("posicao, codigo").eq("processo_id", processoId);
  const r = aplicarCorrespondencia(fichasDoCalculo(docs), rubricas ?? [], await tabelaCorrespondencia(supabase), escolhasExtras);
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
    // o período da dívida fica em branco: o operador preenche (obrigatório) em Informações
    if (!docs.some((d) => d.tipo === "ficha")) return { erro: "Envie pelo menos uma ficha financeira: o contracheque só traz os dados bancários." };
    if (!periodoDosDocumentos(docs)) return { erro: "As fichas financeiras enviadas não têm valores." };
    const dados = dadosDoFavorecido(docs);
    const { data: m, error: e1 } = await supabase.from("militar").insert({
      om_id: omId, nome: dados.nome ?? "(nome não lido)", posto_graduacao: dados.posto_graduacao ?? null, prec_cp: dados.prec_cp ?? null,
      identidade: dados.identidade ?? null, cpf: dados.cpf ?? null, om_vinculacao: dados.om_vinculacao ?? null,
      banco: dados.banco ?? null, agencia: dados.agencia ?? null, conta: dados.conta ?? null,
    }).select("id").single();
    if (e1) return { erro: e1.message };
    const { data: p, error: e2 } = await supabase.from("processo").insert({
      om_id: omId, militar_id: m.id, periodo_inicio: null, periodo_fim: null,
    }).select("id").single();
    if (e2) return { erro: e2.message };
    const { error: e3 } = await inserirRubricasIniciais(supabase, p.id);
    if (e3) return { erro: e3.message };
    await gravarRecebidosDe(supabase, p.id, docs, {});
    destino = `/processos/${p.id}/dados`;
  } catch (e) {
    return { erro: (e as Error).message };
  }
  redirect(destino);
}
