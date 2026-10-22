"use server";
import type { TipoRubrica } from "@painel-ea/engine";
import { revalidatePath } from "next/cache";
import { mesDeData } from "@/lib/lancamentos";
import { erroPosPeriodo, recebidosPosPeriodo, type RecebidoPosPeriodo } from "@/lib/pos-periodo";
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

/** Recebidos após o período da dívida: grava a lista inteira em complementos (cada item validado contra o fim do período). */
export async function salvarRecebidosPosPeriodo(processoId: string, lista: RecebidoPosPeriodo[]) {
  const supabase = await supabaseServidor();
  const { data: p, error: e1 } = await supabase.from("processo").select("periodo_fim, complementos").eq("id", processoId).single();
  if (e1) return { erro: e1.message };
  if (!p.periodo_fim) return { erro: "Informe o período da dívida em Informações." };
  const fim = mesDeData(p.periodo_fim);
  const itens = recebidosPosPeriodo({ recebidosPosPeriodo: lista });
  if (itens.length !== lista.length) return { erro: "Há recebidos após o período com dados inválidos." };
  const erro = itens.map((r) => erroPosPeriodo(r, fim)).find(Boolean);
  if (erro) return { erro: `Recebido após o período: ${erro}` };
  const valores = itens.map((r) => ({ ...r, valor: Math.round(r.valor * 100) / 100 }))
    .sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes) || a.posicao - b.posicao);
  const { error } = await supabase.from("processo")
    .update({ complementos: { ...(p.complementos ?? {}), recebidosPosPeriodo: valores } }).eq("id", processoId);
  if (error) return { erro: error.message };
  revalidatePath(`/processos/${processoId}`, "layout");
  revalidatePath("/processos");
  return { ok: true };
}
