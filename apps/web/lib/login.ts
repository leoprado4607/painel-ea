import { cpfValido } from "@painel-ea/engine";

/**
 * O Supabase Auth só entra por e-mail. Cada usuário tem o e-mail técnico "<11 dígitos do CPF>@cpf.painel-ea.local",
 * criado pela Edge Function gerenciar-usuarios (mesmo domínio lá); ele nunca recebe mensagens.
 */
export const DOMINIO_LOGIN = "cpf.painel-ea.local";

export const soDigitos = (s: string) => s.replace(/\D/g, "");

/** E-mail técnico do CPF digitado, ou null se o CPF for inválido. */
export function emailDoCpf(cpf: string): string | null {
  const d = soDigitos(cpf);
  return d.length === 11 && cpfValido(d) ? `${d}@${DOMINIO_LOGIN}` : null;
}

/** "52998224725" → "529.982.247-25" */
export function formatarCpf(cpf: string | null | undefined): string {
  const d = soDigitos(cpf ?? "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (cpf ?? "");
}
