/**
 * Valor final corrigido de cada processo (Importância Básica Total Corrigida, como nos documentos), para os cards da
 * lista de processos. Emitido: com os índices guardados na emissão (bate com o PDF); rascunho: com os índices atuais.
 */
import { calcular } from "@painel-ea/engine";
import { buscarTodas } from "./buscar-todas";
import { montarEntrada } from "./calculo";
import { usaIpcaEPuro } from "./indice";
import { recebidosPosPeriodo } from "./pos-periodo";
import type { sessao } from "./sessao";
import type { Rubrica } from "@painel-ea/engine";

type Supabase = Awaited<ReturnType<typeof sessao>>["supabase"];
interface ProcessoResumo {
  id: string; situacao: string; periodo_inicio: string | null; periodo_fim: string | null;
  indices_usados?: { ano: number; mes: number; percentual: number | string | null }[] | null;
  complementos?: { recebidosPosPeriodo?: unknown } | null;
  /** Auxílio-fardamento automático: rascunho corrigido pelo IPCA-E puro (lib/indice). */
  especie_divida?: string | null;
}
type Indice = { ano: number; mes: number; percentual: number | string };

/** Processos por consulta (a lista de ids vai no endereço da requisição, que tem tamanho limitado). */
const BLOCO_IDS = 50;
const emBlocos = <T,>(lista: T[]) => Array.from({ length: Math.ceil(lista.length / BLOCO_IDS) }, (_, i) => lista.slice(i * BLOCO_IDS, (i + 1) * BLOCO_IDS));

export async function valoresCorrigidos(supabase: Supabase, processos: ProcessoResumo[]): Promise<Map<string, number | null>> {
  const ids = processos.map((p) => p.id);
  const valores = new Map<string, number | null>();
  if (!ids.length) return valores;
  const blocos = emBlocos(ids);
  let rubricas, lancamentos, indices, ipcaE;
  // IPCA-E puro só se houver rascunho do Auxílio-fardamento automático (emitidos usam os índices guardados)
  const precisaIpcaE = processos.some((p) => p.situacao === "rascunho" && usaIpcaEPuro(p));
  try {
    [rubricas, lancamentos, { data: indices }, { data: ipcaE }] = await Promise.all([
      Promise.all(blocos.map((bloco) => buscarTodas((de, ate) => supabase.from("processo_rubrica")
        .select("processo_id, posicao, codigo, tipo").in("processo_id", bloco)
        .order("processo_id").order("posicao").range(de, ate)))).then((r) => r.flat()),
      Promise.all(blocos.map((bloco) => buscarTodas((de, ate) => supabase.from("lancamento")
        .select("processo_id, tipo, ano, mes, posicao, valor").in("processo_id", bloco)
        .order("processo_id").order("tipo").order("ano").order("mes").order("posicao").range(de, ate)))).then((r) => r.flat()),
      supabase.from("indice_composto").select("ano, mes, percentual"),
      precisaIpcaE ? supabase.from("indice_mensal").select("ano, mes, percentual").eq("serie", "IPCA-E") : Promise.resolve({ data: [] }),
    ]);
  } catch {
    return valores; // sem todos os dados, o card fica sem valor ("R$ —") em vez de mostrar um valor errado
  }
  for (const p of processos) {
    if (!p.periodo_inicio || !p.periodo_fim) { valores.set(p.id, null); continue; }
    const usados = p.situacao !== "rascunho" && p.indices_usados?.length
      ? p.indices_usados.filter((i): i is Indice => i.percentual !== null)
      : ((usaIpcaEPuro(p) ? ipcaE : indices) ?? []) as Indice[];
    if (!usados.length) { valores.set(p.id, null); continue; }
    try {
      const entrada = montarEntrada(
        rubricas.filter((r) => r.processo_id === p.id) as { posicao: number; codigo: string; tipo: Rubrica["tipo"] }[],
        lancamentos.filter((l) => l.processo_id === p.id).map((l) => ({ ...l, valor: Number(l.valor) })),
        usados, { inicio: p.periodo_inicio, fim: p.periodo_fim, posPeriodo: recebidosPosPeriodo(p.complementos) },
      );
      valores.set(p.id, calcular(entrada).cpex.importanciaBasicaTotalCorrigida);
    } catch {
      valores.set(p.id, null);
    }
  }
  return valores;
}
