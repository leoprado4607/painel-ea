"use server";
import type { Complementos } from "@painel-ea/documentos";
import { lerFormularioDocumento } from "@/lib/documentos-form";
import { revalidatePath } from "next/cache";
import { sessao } from "@/lib/sessao";

export interface EstadoDocumento { erro?: string; ok?: boolean; salvoEm?: number }

/** Grava os textos editados numa aba de documento. Processo emitido não muda (é preciso reabrir). */
export async function salvarDocumento(processoId: string, _: EstadoDocumento | undefined, f: FormData): Promise<EstadoDocumento> {
  const { supabase } = await sessao();
  const { data: atual } = await supabase.from("processo").select("situacao, complementos").eq("id", processoId).maybeSingle();
  if (!atual) return { erro: "Processo não encontrado." };
  if (atual.situacao !== "rascunho") return { erro: "Processo já emitido. Reabra na aba Impressão para alterar." };
  const { processo, complementos } = lerFormularioDocumento(f, (atual.complementos ?? {}) as Complementos);
  if (processo.ano !== undefined && processo.ano !== null && (!Number.isInteger(processo.ano) || +processo.ano < 2000 || +processo.ano > 2100)) {
    return { erro: "Ano do processo inválido." };
  }
  const { error } = await supabase.from("processo").update({ ...processo, complementos }).eq("id", processoId);
  if (error) return { erro: error.message };
  revalidatePath(`/processos/${processoId}`, "layout");
  return { ok: true, salvoEm: Date.now() };
}
