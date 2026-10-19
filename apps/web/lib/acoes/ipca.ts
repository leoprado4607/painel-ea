"use server";
import { revalidatePath } from "next/cache";
import { sessao } from "@/lib/sessao";

export interface ResultadoColeta { erro?: string; mensagem?: string }

/** Pede à Edge Function coletar-ipca uma busca imediata dos índices (a mesma que roda todo dia às 09:00). */
export async function buscarIndicesAgora(): Promise<ResultadoColeta> {
  const { supabase } = await sessao();
  const { data, error } = await supabase.functions.invoke("coletar-ipca", { body: {} });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 429) return { erro: "Os índices foram buscados há menos de 10 minutos. Tente de novo mais tarde." };
    return { erro: `Não foi possível buscar os índices: ${error.message}` };
  }
  revalidatePath("/ipca");
  revalidatePath("/passo-a-passo");
  // Resposta: { IPCA: { situacao, novos: ["2026-10"], revisoes }, "IPCA-E": { ... } }
  const series = Object.entries((data ?? {}) as Record<string, { situacao?: string; novos?: string[]; mensagem?: string }>);
  const falhas = series.filter(([, v]) => v?.situacao === "erro").map(([s, v]) => `${s}: ${v.mensagem ?? "erro"}`);
  if (falhas.length) return { erro: `Falha ao buscar ${falhas.join("; ")}` };
  const novos = series.flatMap(([s, v]) => (v?.novos ?? []).map((m) => `${s} ${m.split("-").reverse().join("/")}`));
  return { mensagem: novos.length ? `Meses novos gravados: ${novos.join(", ")}.` : "Busca concluída: nenhum mês novo publicado ainda." };
}
