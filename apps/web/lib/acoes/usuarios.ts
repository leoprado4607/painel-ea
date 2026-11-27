"use server";
import { revalidatePath } from "next/cache";
import { POSTOS } from "@/lib/postos";
import { sessao } from "@/lib/sessao";
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
/**
 * Edição dos dados do operador pelo Admin: posto/graduação, nome e OM (a regra perfil_admin do banco permite).
 * O CPF não muda aqui: é o login (e-mail técnico da conta); para trocar, exclui e cadastra de novo.
 * Processos e cálculos já emitidos guardam o nome de quem emitiu, então não mudam.
 */
export async function editarOperador(usuarioId: string, dados: { posto: string; nome: string; omId: string }): Promise<Resultado> {
  const { supabase, perfil } = await sessao();
  if (perfil?.papel !== "admin") return { erro: "Apenas o Admin pode editar operadores." };
  const nome = dados.nome.trim().replace(/\s+/g, " ");
  if (!nome) return { erro: "Informe o nome." };
  const posto = dados.posto.trim();
  const { data: alvo } = await supabase.from("perfil").select("papel, posto, excluido_em").eq("usuario_id", usuarioId).maybeSingle();
  if (!alvo || alvo.excluido_em) return { erro: "Operador não encontrado." };
  // da lista padrão (assinaturas "NOME - Cb"), ou o que já estava gravado
  if (posto && posto !== alvo.posto && !(POSTOS as readonly string[]).includes(posto)) return { erro: "Posto/graduação inválido." };
  let omId: string | null = dados.omId || null;
  if (omId) {
    const { data: om } = await supabase.from("om").select("id").eq("id", omId).maybeSingle();
    if (!om) return { erro: "Escolha a OM do operador." };
  } else if (alvo.papel === "operador") return { erro: "Escolha a OM do operador." };
  const { error } = await supabase.from("perfil").update({ nome, posto: posto || null, om_id: omId }).eq("usuario_id", usuarioId);
  if (error) return { erro: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/operadores");
  return {};
}
export async function redefinirAcesso(usuarioId: string) {
  return pedir({ acao: "redefinir", usuarioId });
}
