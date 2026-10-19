"use server";
import { revalidatePath } from "next/cache";
import { supabaseServidor } from "@/lib/supabase/server";

type Pedido =
  | { acao: "criar"; cpf: string; nome: string; posto?: string; omId: string }
  | { acao: "desativar" | "reativar" | "excluir" | "redefinir"; usuarioId: string };

export interface Resultado { erro?: string; senhaProvisoria?: string; apagado?: boolean }

/** Chama a Edge Function gerenciar-usuarios com o login do Admin (a chave secreta fica só no Supabase). */
async function pedir(p: Pedido): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.functions.invoke("gerenciar-usuarios", { body: p });
  if (error) {
    let msg = error.message;
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.erro) msg = corpo.erro;
    } catch { /* mantém a mensagem genérica */ }
    return { erro: msg };
  }
  revalidatePath("/operadores");
  return data as Resultado;
}

export async function criarOperador(_: unknown, f: FormData) {
  return pedir({
    acao: "criar", cpf: String(f.get("cpf") ?? ""), nome: String(f.get("nome") ?? ""),
    posto: String(f.get("posto") ?? ""), omId: String(f.get("om_id") ?? ""),
  });
}
export async function alterarSituacao(usuarioId: string, ativo: boolean) {
  return pedir({ acao: ativo ? "reativar" : "desativar", usuarioId });
}
export async function excluirOperador(usuarioId: string) {
  return pedir({ acao: "excluir", usuarioId });
}
export async function redefinirAcesso(usuarioId: string) {
  return pedir({ acao: "redefinir", usuarioId });
}
