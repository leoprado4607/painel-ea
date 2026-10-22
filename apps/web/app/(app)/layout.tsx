import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { BarraLateral, ProvedorProcesso } from "@/components/BarraLateral";
import { COOKIE_TEMA } from "@/lib/tema";
import { sessao } from "@/lib/sessao";

/** Telas internas: barra lateral à esquerda (menu, abas do processo aberto e usuário) e o conteúdo ao lado. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { perfil } = await sessao();
  // senha provisória: trocar antes de usar o sistema (conferido aqui, onde o perfil já foi lido)
  if (perfil?.trocar_senha) redirect("/trocar-senha");
  const admin = perfil?.papel === "admin";
  // modo claro/escuro escolhido na barra lateral (cookie "tema"); sem escolha: Admin escuro, Operador claro
  const escolha = (await cookies()).get(COOKIE_TEMA)?.value;
  const escuro = escolha ? escolha === "escuro" : admin;
  return (
    <ProvedorProcesso>
      {/* modo escuro: tema rústico (globals.css, .tema-escuro) */}
      <div id="raiz-app" className={`min-h-screen lg:flex ${escuro ? "tema-escuro" : ""}`}>
        <BarraLateral admin={admin} escuro={escuro} usuario={[perfil?.posto, perfil?.nome].filter(Boolean).join(" ")} />
        <main className="min-w-0 flex-1 px-4 pb-10 pt-5 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-6xl">
            {perfil ? children : <Aviso tipo="atencao">Seu usuário ainda não foi cadastrado como operador. Peça ao Admin para liberar o acesso.</Aviso>}
          </div>
        </main>
      </div>
    </ProvedorProcesso>
  );
}
