"use client";
import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { entrar } from "./actions";

/** Entrada no estilo do Portal da Div Pg Pes: faixa verde com brasão e filete dourado, formulário abaixo. */
export default function Login() {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-2 border-ouro bg-exercito">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brasao-badm.png" alt="Brasão da B Adm Gu Natal" className="h-14 w-auto object-contain" />
          <div>
            <p className="font-marca text-[15px] italic leading-tight text-white">Divisão de Pagamento de Pessoal</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[.16em] text-ouro-claro">B Adm Gu Natal</p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-3 text-center">
            <p className="rotulo-secao">Acesso restrito</p>
            <h1 className="font-titulo text-[2.1rem] font-semibold leading-tight text-carvao">
              Sistema de cálculo de <em className="font-bold not-italic text-ouro-escuro">DEA</em>
            </h1>
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

      <footer className="bg-carvao px-4 py-3 text-center text-xs text-creme/70">© {new Date().getFullYear()} Divisão de Pagamento de Pessoal · B Adm Gu Natal</footer>
    </div>
  );
}
