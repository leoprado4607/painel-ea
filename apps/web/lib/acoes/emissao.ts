"use server";
import { revalidatePath } from "next/cache";
import { emitir } from "@/lib/emissao";
import { supabaseServidor } from "@/lib/supabase/server";

export async function emitirDocumentos(processoId: string) {
  try {
    const docId = await emitir(processoId);
    revalidatePath(`/processos/${processoId}`, "layout");
    revalidatePath("/processos");
    return { ok: true as const, docId };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Volta o processo para rascunho (para corrigir e emitir nova versão). Os PDFs já emitidos ficam guardados. */
export async function reabrirProcesso(processoId: string) {
  const supabase = await supabaseServidor();
  const { error } = await supabase.from("processo").update({ situacao: "rascunho" }).eq("id", processoId);
  if (error) return { erro: error.message };
  revalidatePath(`/processos/${processoId}`, "layout");
  revalidatePath("/processos");
  return { ok: true as const };
}
