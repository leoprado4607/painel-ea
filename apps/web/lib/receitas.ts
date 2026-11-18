/**
 * Preenchimento automático dos valores recebidos (decisão de 21/10/2026):
 * - só as rubricas de RECEITA escolhidas em "Códigos lançamento", com o valor da ficha do mesmo código;
 * - só os meses entre o início e o fim da dívida;
 * - despesas nunca vêm das fichas (o operador digita);
 * - o que o operador digitou (origem diferente de "pdf") nunca é sobrescrito.
 * O processo guarda só os números das linhas de receita das fichas (processo.fichas_lidas); os PDFs são descartados.
 */
import { aplicarCorrespondencia, type Correspondencia, type FichaFinanceira } from "@painel-ea/leitor-ficha";
import { buscarTodas } from "./buscar-todas";
import { complSalMinAutomatico, planoComplSalMin, rubricasComplSalMin } from "./compl-sal-min";
import type { DocumentoExtraido } from "./favorecido";
import { recebidosPosPeriodo } from "./pos-periodo";
import type { sessao } from "./sessao";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];

export interface FichaLida {
  ano: number;
  sistema: "sippes" | "siappes";
  linhas: { codigo: string; descricao: string; meses: number[] }[];
}
interface Rubrica { posicao: number; codigo: string; tipo?: string }

/** Linhas de receita das fichas enviadas (o contracheque não entra). */
export function fichasLidasDosDocumentos(docs: DocumentoExtraido[]): FichaLida[] {
  return docs.filter((d) => d.tipo === "ficha" && d.ficha.ano).map((d) => ({
    ano: d.ficha.ano!, sistema: d.ficha.sistema ?? "sippes",
    linhas: d.ficha.linhas.filter((l) => l.natureza === "receita").map((l) => ({ codigo: l.codigo, descricao: l.descricao, meses: l.meses })),
  }));
}

/** A ficha nova de um ano substitui a guardada do mesmo ano. */
export function mesclarFichasLidas(atuais: FichaLida[], novas: FichaLida[]): FichaLida[] {
  const anos = new Set(novas.map((f) => f.ano));
  return [...atuais.filter((f) => !anos.has(f.ano)), ...novas].sort((a, b) => a.ano - b.ano);
}

/** Confere a forma do que vem do banco (jsonb). */
export function fichasLidasValidas(x: unknown): FichaLida[] {
  if (!Array.isArray(x)) return [];
  return x.filter((f): f is FichaLida => !!f && Number.isInteger(f.ano) && Array.isArray(f.linhas)
    && f.linhas.every((l: FichaLida["linhas"][number]) => typeof l.codigo === "string" && Array.isArray(l.meses) && l.meses.length === 12));
}

const comoFicha = (f: FichaLida): FichaFinanceira => ({
  sistema: f.sistema, ano: f.ano, totaisLiquidos: null, avisos: [],
  cabecalho: { posto: null, nome: null, precCp: null, identidade: null, cpf: null, codom: null, rm: null, siglaUa: null },
  conferencias: { linhasDivergentes: [], mesesDivergentes: [], ok: true },
  linhas: f.linhas.map((l) => ({ ...l, natureza: "receita", acerto: false, total: l.meses.reduce((a, b) => a + b, 0) })),
});

const mesDe = (data: string | null | undefined) => (data && /^\d{4}-\d{2}/.test(data) ? Number(data.slice(0, 4)) * 12 + Number(data.slice(5, 7)) : null);

/** Valores recebidos das rubricas de receita, a partir das fichas, só dentro do período da dívida. */
export function receitasDoPeriodo(fichas: FichaLida[], rubricas: Rubrica[], tabela: Correspondencia[], inicio: string | null, fim: string | null) {
  const ini = mesDe(inicio), fi = mesDe(fim);
  if (ini === null || fi === null) return [];
  const receitas = rubricas.filter((r) => r.tipo === "Receita" && r.codigo?.trim());
  return aplicarCorrespondencia(fichas.map(comoFicha), receitas, tabela).lancamentos
    .filter((l) => l.ano * 12 + l.mes >= ini && l.ano * 12 + l.mes <= fi)
    .map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor }));
}

export async function tabelaCorrespondencia(supabase: Supabase): Promise<Correspondencia[]> {
  const { data } = await supabase.from("correspondencia_rubrica").select("codigo_rubrica, codigo_sippes");
  return (data ?? []).map((c) => ({ codigoRubrica: c.codigo_rubrica, codigoSippes: c.codigo_sippes }));
}

/**
 * Refaz os recebidos que vieram das fichas: apaga os de origem "pdf" (inclusive despesas antigas) e grava as receitas
 * do período, sem tocar em nenhum valor digitado. Só em rascunho. Devolve quantos valores foram gravados.
 * No complemento de salário mínimo automático (lib/compl-sal-min), também acerta rubricas, devidos e recebidos após o período.
 */
export async function preencherReceitas(supabase: Supabase, processoId: string): Promise<number> {
  const { data: p } = await supabase.from("processo")
    .select("situacao, periodo_inicio, periodo_fim, fichas_lidas, especie_divida, complementos").eq("id", processoId).maybeSingle();
  if (!p || p.situacao !== "rascunho") return 0;
  if (complSalMinAutomatico(p)) return preencherComplSalMin(supabase, processoId, p);
  const [{ data: rubricas }, existentes, tabela] = await Promise.all([
    supabase.from("processo_rubrica").select("posicao, codigo, tipo").eq("processo_id", processoId),
    // todos: um digitado que ficasse de fora da leitura seria sobrescrito pela ficha
    buscarTodas<Existente>((de, ate) => supabase.from("lancamento").select("ano, mes, posicao, origem").match({ processo_id: processoId, tipo: "recebido" })
      .order("ano").order("mes").order("posicao").range(de, ate)),
    tabelaCorrespondencia(supabase),
  ]);
  const novos = receitasDoPeriodo(fichasLidasValidas(p.fichas_lidas), rubricas ?? [], tabela, p.periodo_inicio, p.periodo_fim);
  // devido automático só existe no complemento de salário mínimo: se a espécie mudou, sai (os digitados ficam)
  const { error } = await supabase.from("lancamento").delete().match({ processo_id: processoId, tipo: "devido", origem: "pdf" });
  if (error) throw new Error(error.message);
  return regravarAutomaticos(supabase, processoId, "recebido", existentes, novos);
}

type Valor = { ano: number; mes: number; posicao: number; valor: number };
type Existente = { ano: number; mes: number; posicao: number; origem: string };
const chave = (l: { ano: number; mes: number; posicao: number }) => `${l.ano}-${l.mes}-${l.posicao}`;

/** Troca os lançamentos automáticos (origem "pdf") de um tipo pelos novos, sem tocar nos digitados. */
async function regravarAutomaticos(
  supabase: Supabase, processoId: string, tipo: "recebido" | "devido",
  existentes: Existente[], valores: Valor[],
) {
  const digitados = new Set(existentes.filter((l) => l.origem !== "pdf").map(chave));
  const novos = valores.filter((l) => !digitados.has(chave(l)));
  const { error: e1 } = await supabase.from("lancamento").delete().match({ processo_id: processoId, tipo, origem: "pdf" });
  if (e1) throw new Error(e1.message);
  if (novos.length) {
    const { error } = await supabase.from("lancamento").upsert(novos.map((l) => ({
      ...l, processo_id: processoId, tipo, origem: "pdf", documento_id: null,
    })));
    if (error) throw new Error(error.message);
  }
  return novos.length;
}

/** Complemento de salário mínimo: rubricas AGA/AR0061, recebidos do período, recebidos após o período e devidos. */
async function preencherComplSalMin(
  supabase: Supabase, processoId: string,
  p: { periodo_inicio: string | null; periodo_fim: string | null; fichas_lidas: unknown; complementos: unknown },
) {
  const [{ data: rubricas }, lanc] = await Promise.all([
    supabase.from("processo_rubrica").select("posicao, codigo, tipo").eq("processo_id", processoId),
    buscarTodas<Existente & { tipo: string }>((de, ate) => supabase.from("lancamento").select("tipo, ano, mes, posicao, origem").eq("processo_id", processoId)
      .order("tipo").order("ano").order("mes").order("posicao").range(de, ate)),
  ]);
  const plano = p.periodo_inicio && p.periodo_fim
    ? planoComplSalMin(fichasLidasValidas(p.fichas_lidas), p.periodo_inicio, p.periodo_fim)
    : null;
  const { mudadas, posicaoAga, posicaoGr } = rubricasComplSalMin(rubricas ?? [], !!plano?.gr.length);
  if (mudadas.length) {
    const { error } = await supabase.from("processo_rubrica")
      .upsert(mudadas.map((r) => ({ processo_id: processoId, posicao: r.posicao, codigo: r.codigo, tipo: r.tipo })));
    if (error) throw new Error(error.message);
  }
  if (!plano || posicaoAga === null) return 0;
  const naPosicao = (lista: { ano: number; mes: number; valor: number }[], posicao: number | null): Valor[] =>
    posicao === null ? [] : lista.map((v) => ({ ...v, posicao }));
  const recebidos = [...naPosicao(plano.aga, posicaoAga), ...naPosicao(plano.gr, posicaoGr)];
  const n = await regravarAutomaticos(supabase, processoId, "recebido", lanc.filter((l) => l.tipo === "recebido"), recebidos);
  await regravarAutomaticos(supabase, processoId, "devido", lanc.filter((l) => l.tipo === "devido"), naPosicao(plano.devidos, posicaoAga));
  // recebido após o período: acrescenta (ou atualiza) o AGA de cada mês; os itens digitados pelo operador ficam
  if (plano.posPeriodo.length) {
    const atuais = recebidosPosPeriodo(p.complementos as { recebidosPosPeriodo?: unknown });
    const novos = naPosicao(plano.posPeriodo, posicaoAga);
    const lista = [...atuais.filter((a) => !novos.some((x) => chave(x) === chave(a))), ...novos]
      .sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes) || a.posicao - b.posicao);
    if (JSON.stringify(lista) !== JSON.stringify(atuais)) {
      const { error } = await supabase.from("processo")
        .update({ complementos: { ...((p.complementos as object) ?? {}), recebidosPosPeriodo: lista } }).eq("id", processoId);
      if (error) throw new Error(error.message);
    }
  }
  return n;
}
