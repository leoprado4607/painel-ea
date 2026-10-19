import { redirect } from "next/navigation";
import { supabaseServidor } from "./supabase/server";
import type { Om, Perfil } from "./tipos";

/** Usuário logado, com perfil e OM. Redireciona para o login se não houver sessão. */
export async function sessao() {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfil").select("*").eq("usuario_id", user.id).maybeSingle<Perfil>();
  const { data: om } = perfil?.om_id
    ? await supabase.from("om").select("*").eq("id", perfil.om_id).maybeSingle<Om>()
    : { data: null };
  return { supabase, user, perfil, om };
}
