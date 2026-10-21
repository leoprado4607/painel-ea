/**
 * Preenchimento automático dos valores recebidos (decisão de 21/10/2026):
 * - só as rubricas de RECEITA escolhidas em "Códigos lançamento", com o valor da ficha do mesmo código;
 * - só os meses entre o início e o fim da dívida;
 * - despesas nunca vêm das fichas (o operador digita);
 * - o que o operador digitou (origem diferente de "pdf") nunca é sobrescrito.
 * O processo guarda só os números das linhas de receita das fichas (processo.fichas_lidas); os PDFs são descartados.
 */
import { aplicarCorrespondencia, type Correspondencia, type FichaFinanceira } from "@painel-ea/leitor-ficha";
import type { DocumentoExtraido } from "./favorecido";
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
 */
export async function preencherReceitas(supabase: Supabase, processoId: string): Promise<number> {
  const { data: p } = await supabase.from("processo").select("situacao, periodo_inicio, periodo_fim, fichas_lidas").eq("id", processoId).maybeSingle();
  if (!p || p.situacao !== "rascunho") return 0;
  const [{ data: rubricas }, { data: existentes }, tabela] = await Promise.all([
    supabase.from("processo_rubrica").select("posicao, codigo, tipo").eq("processo_id", processoId),
    supabase.from("lancamento").select("ano, mes, posicao, origem").match({ processo_id: processoId, tipo: "recebido" }),
    tabelaCorrespondencia(supabase),
  ]);
  const chave = (l: { ano: number; mes: number; posicao: number }) => `${l.ano}-${l.mes}-${l.posicao}`;
  const digitados = new Set((existentes ?? []).filter((l) => l.origem !== "pdf").map(chave));
  const novos = receitasDoPeriodo(fichasLidasValidas(p.fichas_lidas), rubricas ?? [], tabela, p.periodo_inicio, p.periodo_fim)
    .filter((l) => !digitados.has(chave(l)));
  const { error: e1 } = await supabase.from("lancamento").delete().match({ processo_id: processoId, tipo: "recebido", origem: "pdf" });
  if (e1) throw new Error(e1.message);
  if (novos.length) {
    const { error } = await supabase.from("lancamento").upsert(novos.map((l) => ({
      ...l, processo_id: processoId, tipo: "recebido", origem: "pdf", documento_id: null,
    })));
    if (error) throw new Error(error.message);
  }
  return novos.length;
}
