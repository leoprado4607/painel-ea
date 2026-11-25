"use server";
/**
 * Leitura de uma peça do processo completo do Auxílio-fardamento (lib/processo-completo). O navegador abre o ZIP do
 * SPED e manda uma peça por vez (a Vercel recusa envios acima de ~4,5 MB); aqui ela é lida na memória e descartada.
 */
import { lerPeca, LIMITE_PECA } from "@/lib/ler-peca";
import type { TipoPeca } from "@/lib/processo-completo";
import { sessao } from "@/lib/sessao";

export async function lerPecaDoProcesso(form: FormData): Promise<{ tipo: TipoPeca; texto?: string; erro?: string }> {
  await sessao(); // fora do try: sem login, vai para a tela de entrada
  try {
    const arquivo = form.get("peca");
    if (!(arquivo instanceof File) || !arquivo.size) return { tipo: "ignorada" };
    if (arquivo.size > LIMITE_PECA) return { tipo: "grande" };
    return await lerPeca(new Uint8Array(await arquivo.arrayBuffer()));
  } catch (e) {
    return { tipo: "ignorada", erro: (e as Error).message };
  }
}
