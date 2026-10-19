"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { supabaseNavegador } from "@/lib/supabase/client";

/** Troca obrigatória da senha provisória no primeiro acesso. */
export default function TrocarSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 10 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return setErro("Use pelo menos 10 caracteres, com letras e números.");
    if (senha !== repetir) return setErro("As senhas não conferem.");
    setOcupado(true);
    setErro(null);
    const supabase = supabaseNavegador();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) { setOcupado(false); return setErro(error.message.includes("different") ? "A nova senha precisa ser diferente da provisória." : error.message); }
    const { error: e2 } = await supabase.rpc("concluir_troca_senha");
    setOcupado(false);
    if (e2) return setErro(e2.message);
    router.replace("/processos");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={salvar} className="cartao w-full max-w-sm space-y-4">
        <h1 className="text-lg font-bold">Crie sua senha</h1>
        <p className="text-sm text-suave">Este é seu primeiro acesso. Troque a senha provisória por uma senha pessoal.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div>
          <label htmlFor="senha" className="rotulo">Nova senha</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="entrada" />
          <p className="ajuda">Mínimo de 10 caracteres, com letras e números.</p>
        </div>
        <div>
          <label htmlFor="repetir" className="rotulo">Repita a nova senha</label>
          <input id="repetir" type="password" autoComplete="new-password" required value={repetir} onChange={(e) => setRepetir(e.target.value)} className="entrada" />
        </div>
        <button className="botao w-full" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar senha"}</button>
      </form>
    </main>
  );
}
