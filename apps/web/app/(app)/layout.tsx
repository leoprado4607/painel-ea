import Link from "next/link";
import { sair } from "@/app/login/actions";
import { AbasRodape } from "@/components/AbasRodape";
import { Aviso } from "@/components/Aviso";
import { sessao } from "@/lib/sessao";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { perfil, om } = await sessao();
  const admin = perfil?.papel === "admin";
  return (
    <div className="min-h-screen">
      <header className="border-b border-borda bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-4">
            <Link href="/processos" className="font-bold text-marca-800">Painel EA</Link>
            <Link href="/processos" className="text-sm text-suave hover:text-tinta">Processos</Link>
            <Link href="/processos/novo" className="text-sm text-suave hover:text-tinta">Novo processo</Link>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-suave sm:inline">
              {[perfil?.posto, perfil?.nome].filter(Boolean).join(" ")}{admin ? " · Admin" : om ? ` · ${om.nome}` : ""}
            </span>
            <form action={sair}><button className="botao-sec py-1.5">Sair</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        {perfil ? children : <Aviso tipo="atencao">Seu usuário ainda não foi cadastrado como operador. Peça ao Admin para liberar o acesso.</Aviso>}
      </main>
      {perfil && <AbasRodape admin={admin} />}
    </div>
  );
}
