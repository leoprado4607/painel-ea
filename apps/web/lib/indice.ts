import { auxFardAutomatico } from "./aux-fard";
import type { sessao } from "./sessao";
import { MESES } from "./tipos";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];
export type IndiceDoMes = { ano: number; mes: number; percentual: number | string };

/** IPCA-E puro (sem a regra composta): Auxílio-fardamento automático (Port Normativa 40/MD/2004; decisão de 24/11/2026). */
export const usaIpcaEPuro = (p: { especie_divida?: string | null; complementos?: unknown }) => auxFardAutomatico(p);

/**
 * Índices de correção do processo e o texto da série para os documentos: no Auxílio-fardamento automático, o IPCA-E
 * puro (indice_mensal); nos demais, a série composta pela regra de vigência (view indice_composto).
 */
export async function indicesDoProcesso(supabase: Supabase, p: { especie_divida?: string | null; complementos?: unknown }) {
  if (usaIpcaEPuro(p)) {
    const { data } = await supabase.from("indice_mensal").select("ano, mes, percentual").eq("serie", "IPCA-E");
    return { indices: (data ?? []) as IndiceDoMes[], descricao: "IPCA-E" };
  }
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
