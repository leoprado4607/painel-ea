"use server";
import type { TipoRubrica } from "@painel-ea/engine";
import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";

export async function salvarRubricas(processoId: string, rubricas: { posicao: number; codigo: string; tipo: TipoRubrica }[]) {
  const supabase = await supabaseServidor();
  const linhas = rubricas.map((r) => ({ processo_id: processoId, posicao: r.posicao, codigo: r.codigo.trim(), tipo: r.tipo }));
  const { error } = await supabase.from("processo_rubrica").upsert(linhas);
  if (error) return { erro: error.message };
  revalidatePath(`/processos/${processoId}`, "layout");
  return { ok: true };
}

export async function salvarLancamentos(
  processoId: string,
  tipo: "recebido" | "devido",
  gravar: { ano: number; mes: number; posicao: number; valor: number }[],
  apagar: { ano: number; mes: number; posicao: number }[],
) {
  const supabase = await supabaseServidor();
  if (gravar.length) {
    const { error } = await supabase.from("lancamento")
      .upsert(gravar.map((l) => ({ ...l, processo_id: processoId, tipo, origem: "digitado" })));
    if (error) return { erro: error.message };
  }
  for (const l of apagar) {
    const { error } = await supabase.from("lancamento").delete()
      .match({ processo_id: processoId, tipo, ano: l.ano, mes: l.mes, posicao: l.posicao });
    if (error) return { erro: error.message };
  }
  revalidatePath(`/processos/${processoId}`, "layout");
  return { ok: true };
}
