/**
 * Valor final corrigido de cada processo (Importância Básica Total Corrigida, como nos documentos), para os cards da
 * lista de processos. Emitido: com os índices guardados na emissão (bate com o PDF); rascunho: com os índices atuais.
 */
import { calcular } from "@painel-ea/engine";
import { montarEntrada } from "./calculo";
import type { sessao } from "./sessao";
import type { Rubrica } from "@painel-ea/engine";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];
interface ProcessoResumo {
  id: string; situacao: string; periodo_inicio: string | null; periodo_fim: string | null;
  indices_usados?: { ano: number; mes: number; percentual: number | string | null }[] | null;
}
type Indice = { ano: number; mes: number; percentual: number | string };

export async function valoresCorrigidos(supabase: Supabase, processos: ProcessoResumo[]): Promise<Map<string, number | null>> {
  const ids = processos.map((p) => p.id);
  const valores = new Map<string, number | null>();
  if (!ids.length) return valores;
  const [{ data: rubricas }, { data: lancamentos }, { data: indices }] = await Promise.all([
    supabase.from("processo_rubrica").select("processo_id, posicao, codigo, tipo").in("processo_id", ids),
    supabase.from("lancamento").select("processo_id, tipo, ano, mes, posicao, valor").in("processo_id", ids),
    supabase.from("indice_composto").select("ano, mes, percentual"),
  ]);
  for (const p of processos) {
    if (!p.periodo_inicio || !p.periodo_fim) { valores.set(p.id, null); continue; }
    const usados = p.situacao !== "rascunho" && p.indices_usados?.length
      ? p.indices_usados.filter((i): i is Indice => i.percentual !== null)
      : (indices ?? []) as Indice[];
    if (!usados.length) { valores.set(p.id, null); continue; }
    try {
      const entrada = montarEntrada(
        (rubricas ?? []).filter((r) => r.processo_id === p.id) as { posicao: number; codigo: string; tipo: Rubrica["tipo"] }[],
        (lancamentos ?? []).filter((l) => l.processo_id === p.id).map((l) => ({ ...l, valor: Number(l.valor) })),
        usados, { inicio: p.periodo_inicio, fim: p.periodo_fim },
      );
      valores.set(p.id, calcular(entrada).cpex.importanciaBasicaTotalCorrigida);
    } catch {
      valores.set(p.id, null);
    }
  }
  return valores;
}
