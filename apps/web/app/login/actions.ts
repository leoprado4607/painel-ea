"use server";
import { redirect } from "next/navigation";
import { emailDoCpf } from "@/lib/login";
import { supabaseServidor } from "@/lib/supabase/server";

export async function entrar(_: { erro?: string } | undefined, form: FormData) {
  const email = emailDoCpf(String(form.get("cpf") ?? ""));
  if (!email) return { erro: "CPF inválido. Confira os 11 dígitos." };
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(form.get("senha") ?? "") });
  if (error) return { erro: "CPF ou senha incorretos." };
  redirect("/mfa");
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
