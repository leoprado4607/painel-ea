"use server";
import type { TipoRubrica } from "@painel-ea/engine";
import { revalidatePath } from "next/cache";
import { preencherReceitas } from "@/lib/receitas";
import { supabaseServidor } from "@/lib/supabase/server";

export async function salvarRubricas(processoId: string, rubricas: { posicao: number; codigo: string; tipo: TipoRubrica }[]) {
  const supabase = await supabaseServidor();
  const linhas = rubricas.map((r) => ({ processo_id: processoId, posicao: r.posicao, codigo: r.codigo.trim(), tipo: r.tipo }));
  const { error } = await supabase.from("processo_rubrica").upsert(linhas);
  if (error) return { erro: error.message };
  // rubricas de receita mudaram: refaz os recebidos que vêm das fichas (sem tocar nos digitados)
  try { await preencherReceitas(supabase, processoId); } catch (e) { return { erro: (e as Error).message }; }
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
  // recebido zerado pelo operador fica gravado como 0 digitado: assim a ficha não volta a preencher o campo
  if (tipo === "recebido" && apagar.length) {
    const { error } = await supabase.from("lancamento")
      .upsert(apagar.map((l) => ({ ...l, valor: 0, processo_id: processoId, tipo, origem: "digitado" })));
    if (error) return { erro: error.message };
  }
  for (const l of tipo === "recebido" ? [] : apagar) {
    const { error } = await supabase.from("lancamento").delete()
      .match({ processo_id: processoId, tipo, ano: l.ano, mes: l.mes, posicao: l.posicao });
    if (error) return { erro: error.message };
  }
  revalidatePath(`/processos/${processoId}`, "layout");
  return { ok: true };
}
