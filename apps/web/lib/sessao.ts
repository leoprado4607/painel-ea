import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServidor } from "./supabase/server";
import type { Om, Perfil } from "./tipos";

/**
 * Usuário logado, com perfil e OM. Redireciona para o login se não houver sessão.
 * Uma vez por requisição (cache): layouts e página reaproveitam o mesmo resultado.
 * getClaims valida o token localmente (chaves de assinatura do Supabase); sem elas, faz o mesmo que getUser.
 */
export const sessao = cache(async () => {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");
  const { data: linha } = await supabase.from("perfil").select("*, om:om_id(*)").eq("usuario_id", id).maybeSingle<Perfil & { om: Om | null }>();
  const { om = null, ...perfil } = linha ?? {};
  return { supabase, user: { id }, perfil: linha ? (perfil as Perfil) : null, om };
});
