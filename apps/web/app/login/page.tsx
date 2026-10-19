"use client";
import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { entrar } from "./actions";

export default function Login() {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-marca-700">Exército Brasileiro</p>
          <h1 className="mt-1 text-2xl font-bold">Painel de Exercício Anterior</h1>
          <p className="mt-1 text-sm text-suave">Acesso restrito às OM cadastradas</p>
        </div>
        <form action={acao} className="cartao space-y-4">
          {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          <div>
            <label htmlFor="cpf" className="rotulo">CPF</label>
            <input id="cpf" name="cpf" inputMode="numeric" autoComplete="username" placeholder="000.000.000-00"
              maxLength={14} required className="entrada" />
          </div>
          <div>
            <label htmlFor="senha" className="rotulo">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="current-password" required className="entrada" />
          </div>
          <button className="botao w-full" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
          <p className="ajuda text-center">Esqueceu a senha? Peça ao Admin para redefinir o seu acesso.</p>
        </form>
      </div>
    </main>
  );
}
