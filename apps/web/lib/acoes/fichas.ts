"use server";
import {
  aplicarCorrespondencia, lerFichaPdf, periodoDasFichas, type Correspondencia, type FichaFinanceira,
} from "@painel-ea/leitor-ficha";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { omParaNovoProcesso } from "@/lib/processo";
import { sessao } from "@/lib/sessao";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

export interface ResumoFicha {
  documentoId: string;
  arquivo: string;
  ano: number | null;
  linhas: number;
  conferenciaOk: boolean;
  avisos: string[];
}
export interface Previa {
  erro?: string;
  fichas?: ResumoFicha[];
  /** Diferenças entre o cabeçalho das fichas e o cadastro do militar. */
  divergenciasMilitar?: string[];
  lancamentos?: { ano: number; mes: number; posicao: number; valor: number }[];
  naoUsadas?: { ano: number; codigo: string; descricao: string; natureza: string; total: number }[];
  anos?: number[];
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const soDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

async function tabelaCorrespondencia(supabase: Supabase): Promise<Correspondencia[]> {
  const { data } = await supabase.from("correspondencia_rubrica").select("codigo_rubrica, codigo_sippes");
  return (data ?? []).map((c) => ({ codigoRubrica: c.codigo_rubrica, codigoSippes: c.codigo_sippes }));
}

/** Lê os PDFs enviados no formulário (campo "fichas"). */
async function lerArquivos(form: FormData) {
  const arquivos = form.getAll("fichas").filter((f): f is File => f instanceof File && f.size > 0);
  if (!arquivos.length) throw new Error("Selecione pelo menos um PDF.");
  const lidos: { nome: string; bytes: Uint8Array; ficha: FichaFinanceira }[] = [];
  for (const a of arquivos) {
    if (!a.name.toLowerCase().endsWith(".pdf")) throw new Error(`${a.name} não é PDF.`);
    const bytes = new Uint8Array(await a.arrayBuffer());
    let ficha: FichaFinanceira;
    try {
      ficha = await lerFichaPdf(bytes);
    } catch {
      throw new Error(`Não foi possível ler ${a.name}. Confira se é a Ficha Financeira do SIPPES em PDF.`);
    }
    if (!ficha.linhas.length) throw new Error(`${a.name}: não encontrei a tabela da Ficha Financeira.`);
    lidos.push({ nome: a.name, bytes, ficha });
  }
  return lidos;
}

/** Guarda o PDF no Storage (<om>/<processo>/<id>.pdf) e registra o documento. Reaproveita se já foi enviado. */
async function guardarPdf(supabase: Supabase, omId: string, processoId: string, nome: string, bytes: Uint8Array, ano: number | null) {
  const hash = sha256(bytes);
  const { data: existente } = await supabase.from("documento").select("id")
    .eq("processo_id", processoId).eq("sha256", hash).maybeSingle();
  if (existente) return existente.id as string;
  const caminho = `${omId}/${processoId}/${randomUUID()}.pdf`;
  const up = await supabase.storage.from("documentos").upload(caminho, bytes, { contentType: "application/pdf" });
  if (up.error) throw new Error(`Falha ao guardar ${nome}: ${up.error.message}`);
  const { data, error } = await supabase.from("documento").insert({
    processo_id: processoId, om_id: omId, tipo: "ficha_financeira_pdf", ano, caminho_storage: caminho,
    sha256: hash, tamanho_bytes: bytes.length,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

function compararMilitar(f: FichaFinanceira, m: Record<string, string | null>) {
  const d: string[] = [];
  const cab = f.cabecalho;
  if (m.nome && cab.nome && m.nome.trim().toUpperCase() !== cab.nome.trim().toUpperCase()) d.push("nome");
  if (m.cpf && cab.cpf && soDigitos(m.cpf) !== soDigitos(cab.cpf)) d.push("CPF");
  if (m.prec_cp && cab.precCp && soDigitos(m.prec_cp) !== soDigitos(cab.precCp)) d.push("Prec-CP");
  if (m.identidade && cab.identidade && soDigitos(m.identidade) !== soDigitos(cab.identidade)) d.push("identidade");
  return d;
}

/** Envia as fichas de um processo existente: guarda os PDFs e devolve a prévia (nada é gravado nos valores ainda). */
export async function analisarFichas(processoId: string, _: Previa | undefined, form: FormData): Promise<Previa> {
  try {
    const { supabase } = await sessao();
    const lidos = await lerArquivos(form);
    const [{ data: processo }, { data: rubricas }] = await Promise.all([
      supabase.from("processo").select("id, om_id, situacao, militar:militar_id(nome, cpf, prec_cp, identidade)").eq("id", processoId).single(),
      supabase.from("processo_rubrica").select("posicao, codigo").eq("processo_id", processoId),
    ]);
    if (!processo) return { erro: "Processo não encontrado." };
    if (processo.situacao !== "rascunho") return { erro: "Processo já emitido." };
    const fichas: ResumoFicha[] = [];
    for (const l of lidos) {
      const documentoId = await guardarPdf(supabase, processo.om_id, processoId, l.nome, l.bytes, l.ficha.ano);
      fichas.push({ documentoId, arquivo: l.nome, ano: l.ficha.ano, linhas: l.ficha.linhas.length, conferenciaOk: l.ficha.conferencias.ok, avisos: l.ficha.avisos });
    }
    const militar = (processo.militar ?? {}) as unknown as Record<string, string | null>;
    const divergencias = [...new Set(lidos.flatMap((l) => compararMilitar(l.ficha, militar)))];
    const r = aplicarCorrespondencia(lidos.map((l) => l.ficha), rubricas ?? [], await tabelaCorrespondencia(supabase));
    return {
      fichas, divergenciasMilitar: divergencias,
      lancamentos: r.lancamentos.map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor })),
      naoUsadas: r.naoUsadas.map(({ ano, codigo, descricao, natureza, total }) => ({ ano, codigo, descricao, natureza, total })),
      anos: [...new Set(lidos.map((l) => l.ficha.ano!).filter(Boolean))].sort(),
    };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Prévia a partir dos PDFs já guardados no processo (sem reenviar). */
export async function previaDosGuardados(processoId: string): Promise<Previa> {
  try {
    const { supabase } = await sessao();
    const [{ data: docs }, { data: rubricas }] = await Promise.all([
      supabase.from("documento").select("id, caminho_storage, ano").eq("processo_id", processoId).eq("tipo", "ficha_financeira_pdf").order("ano"),
      supabase.from("processo_rubrica").select("posicao, codigo").eq("processo_id", processoId),
    ]);
    if (!docs?.length) return {};
    const fichas: ResumoFicha[] = [];
    const lidas: FichaFinanceira[] = [];
    for (const d of docs) {
      const { data } = await supabase.storage.from("documentos").download(d.caminho_storage);
      if (!data) continue;
      const f = await lerFichaPdf(new Uint8Array(await data.arrayBuffer()));
      lidas.push(f);
      fichas.push({ documentoId: d.id, arquivo: `Ficha ${f.ano ?? "?"}`, ano: f.ano, linhas: f.linhas.length, conferenciaOk: f.conferencias.ok, avisos: f.avisos });
    }
    const r = aplicarCorrespondencia(lidas, rubricas ?? [], await tabelaCorrespondencia(supabase));
    return {
      fichas, divergenciasMilitar: [],
      lancamentos: r.lancamentos.map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor })),
      naoUsadas: r.naoUsadas.map(({ ano, codigo, descricao, natureza, total }) => ({ ano, codigo, descricao, natureza, total })),
      anos: [...new Set(lidas.map((f) => f.ano!).filter(Boolean))].sort(),
    };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Relê os PDFs guardados e grava os valores recebidos (substitui os recebidos dos anos das fichas). */
export async function aplicarFichas(processoId: string, documentoIds: string[], escolhasExtras: Record<string, number>) {
  try {
    const { supabase } = await sessao();
    const r = await gravarRecebidosDosDocumentos(supabase, processoId, documentoIds, escolhasExtras);
    revalidatePath(`/processos/${processoId}`, "layout");
    return r;
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

async function gravarRecebidosDosDocumentos(supabase: Supabase, processoId: string, documentoIds: string[], escolhasExtras: Record<string, number>) {
  const { data: docs } = await supabase.from("documento").select("id, caminho_storage").in("id", documentoIds).eq("processo_id", processoId);
  if (!docs?.length) throw new Error("Documentos não encontrados.");
  const fichas: { docId: string; ficha: FichaFinanceira }[] = [];
  for (const d of docs) {
    const { data, error } = await supabase.storage.from("documentos").download(d.caminho_storage);
    if (error || !data) throw new Error("Falha ao reler o PDF guardado.");
    fichas.push({ docId: d.id, ficha: await lerFichaPdf(new Uint8Array(await data.arrayBuffer())) });
  }
  const { data: rubricas } = await supabase.from("processo_rubrica").select("posicao, codigo").eq("processo_id", processoId);
  const tabela = await tabelaCorrespondencia(supabase);
  const anos = [...new Set(fichas.map((f) => f.ficha.ano).filter((a): a is number => !!a))];
  for (const ano of anos) {
    const { error } = await supabase.from("lancamento").delete().match({ processo_id: processoId, tipo: "recebido", ano });
    if (error) throw new Error(error.message);
  }
  let gravados = 0;
  for (const { docId, ficha } of fichas) {
    const r = aplicarCorrespondencia([ficha], rubricas ?? [], tabela, escolhasExtras);
    if (!r.lancamentos.length) continue;
    const { error } = await supabase.from("lancamento").upsert(r.lancamentos.map((l) => ({
      processo_id: processoId, tipo: "recebido", ano: l.ano, mes: l.mes, posicao: l.posicao, valor: l.valor,
      origem: "pdf", documento_id: docId,
    })));
    if (error) throw new Error(error.message);
    gravados += r.lancamentos.length;
  }
  return { ok: true as const, gravados, anos };
}

/** Novo processo a partir das fichas: cria militar e processo com os dados do cabeçalho e já grava os recebidos. */
export async function criarProcessoDeFichas(_: { erro?: string } | undefined, form: FormData): Promise<{ erro?: string }> {
  let destino: string;
  try {
    const { supabase, perfil } = await sessao();
    const omId = await omParaNovoProcesso(supabase, perfil, String(form.get("om_id") ?? "") || null);
    const lidos = await lerArquivos(form);
    const cab = lidos.map((l) => l.ficha.cabecalho).find((c) => c.nome) ?? lidos[0]!.ficha.cabecalho;
    const nomes = new Set(lidos.map((l) => l.ficha.cabecalho.cpf).filter(Boolean));
    if (nomes.size > 1) return { erro: "As fichas enviadas são de militares diferentes (CPFs diferentes)." };
    const periodo = periodoDasFichas(lidos.map((l) => l.ficha));
    if (!periodo) return { erro: "As fichas não têm valores." };

    const { data: m, error: e1 } = await supabase.from("militar").insert({
      om_id: omId, nome: cab.nome ?? "(nome não lido)", posto_graduacao: cab.posto, prec_cp: cab.precCp,
      identidade: cab.identidade, cpf: cab.cpf,
    }).select("id").single();
    if (e1) return { erro: e1.message };
    const { data: p, error: e2 } = await supabase.from("processo").insert({
      om_id: omId, militar_id: m.id, periodo_inicio: periodo.inicio, periodo_fim: periodo.fim,
    }).select("id").single();
    if (e2) return { erro: e2.message };
    const { data: padrao } = await supabase.from("rubrica_padrao").select("posicao, codigo, tipo").order("posicao");
    const { error: e3 } = await supabase.from("processo_rubrica").insert((padrao ?? []).map((r) => ({ ...r, processo_id: p.id })));
    if (e3) return { erro: e3.message };
    const ids: string[] = [];
    for (const l of lidos) ids.push(await guardarPdf(supabase, omId, p.id, l.nome, l.bytes, l.ficha.ano));
    await gravarRecebidosDosDocumentos(supabase, p.id, ids, {});
    destino = `/processos/${p.id}/recebidos?importado=1`;
  } catch (e) {
    return { erro: (e as Error).message };
  }
  redirect(destino);
}
