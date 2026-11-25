import type { sessao } from "./sessao";
import { MESES } from "./tipos";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];
export type IndiceDoMes = { ano: number; mes: number; percentual: number | string };

/**
 * Índices de correção do processo e o texto da série para os documentos: a série composta pela regra de vigência
 * (view indice_composto), em todas as espécies. O Auxílio-fardamento também: os processos pagos conferidos em
 * 25/11/2026 batem com a composta (IPCA até ago/2025 e IPCA-E depois), não com o IPCA-E puro.
 */
export async function indicesDoProcesso(supabase: Supabase, _p?: { especie_divida?: string | null; complementos?: unknown }) {
  const [{ data: indices }, { data: regras }] = await Promise.all([
    supabase.from("indice_composto").select("ano, mes, percentual"),
    supabase.from("regra_indice").select("vigencia_inicio, serie").order("vigencia_inicio"),
  ]);
  return { indices: (indices ?? []) as IndiceDoMes[], descricao: descreverRegra(regras ?? []) };
}

/** "IPCA até ago/2025 e IPCA-E a partir de set/2025", a partir da tabela regra_indice. */
export function descreverRegra(regras: { vigencia_inicio: string; serie: string }[]): string {
  const curto = (ano: number, mes: number) => `${MESES[mes - 1]!.slice(0, 3).toLowerCase()}/${ano}`;
  return regras.map((g, i, l) => {
    const seguinte = l[i + 1];
    if (!seguinte) return i === 0 ? g.serie : `${g.serie} a partir de ${curto(+g.vigencia_inicio.slice(0, 4), +g.vigencia_inicio.slice(5, 7))}`;
    const [a, m] = [+seguinte.vigencia_inicio.slice(0, 4), +seguinte.vigencia_inicio.slice(5, 7)];
    return `${g.serie} até ${m === 1 ? curto(a - 1, 12) : curto(a, m - 1)}`;
  }).join(" e ");
}

export const dataPorExtenso = (d = new Date()) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
