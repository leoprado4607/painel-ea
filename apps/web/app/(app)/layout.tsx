import { redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { BarraLateral, ProvedorProcesso } from "@/components/BarraLateral";
import { sessao } from "@/lib/sessao";

/** Telas internas: barra lateral à esquerda (menu, abas do processo aberto e usuário) e o conteúdo ao lado. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { perfil } = await sessao();
  // senha provisória: trocar antes de usar o sistema (conferido aqui, onde o perfil já foi lido)
  if (perfil?.trocar_senha) redirect("/trocar-senha");
  const admin = perfil?.papel === "admin";
  return (
    <ProvedorProcesso>
      <div className="min-h-screen lg:flex">
        <BarraLateral admin={admin} usuario={[perfil?.posto, perfil?.nome].filter(Boolean).join(" ")} />
        <main className="min-w-0 flex-1 px-4 pb-10 pt-5 lg:px-8 lg:pt-8">
          <div className="mx-auto max-w-6xl">
            {perfil ? children : <Aviso tipo="atencao">Seu usuário ainda não foi cadastrado como operador. Peça ao Admin para liberar o acesso.</Aviso>}
          </div>
        </main>
      </div>
    </ProvedorProcesso>
  );
}
