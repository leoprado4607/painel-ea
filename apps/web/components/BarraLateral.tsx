"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { sair } from "@/app/login/actions";
import { abaAtiva, type Aba } from "@/lib/abas";
import { DOCUMENTOS, FOCO, LANCAMENTOS, Numero, Ponto, SeloSituacao, type SituacaoProcesso } from "./abas-processo-ui";

/* ------------------------------------------------------------------ processo aberto
 * O layout do processo "registra" o processo aberto; a barra lateral (do layout geral, que não recarrega ao
 * navegar) mostra as abas dele logo abaixo de "Processos".
 */
interface ProcessoAberto { id: string; titulo: string; subtitulo: string; situacao: SituacaoProcesso }
const Contexto = createContext<{ processo: ProcessoAberto | null; definir: (p: ProcessoAberto | null) => void }>({ processo: null, definir: () => {} });

export function ProvedorProcesso({ children }: { children: React.ReactNode }) {
  const [processo, definir] = useState<ProcessoAberto | null>(null);
  return <Contexto.Provider value={{ processo, definir }}>{children}</Contexto.Provider>;
}

export function RegistrarProcesso(p: ProcessoAberto) {
  const { definir } = useContext(Contexto);
  const { id, titulo, subtitulo, situacao } = p;
  useEffect(() => { definir({ id, titulo, subtitulo, situacao }); }, [definir, id, titulo, subtitulo, situacao]);
  return null;
}

/* ------------------------------------------------------------------ itens */
interface Item { rotulo: string; href: string; ativo: (caminho: string) => boolean }
const PRINCIPAIS: Item[] = [
  { rotulo: "Passo a passo", href: "/passo-a-passo", ativo: (c) => c === "/passo-a-passo" },
  // destacado também dentro de um processo (as abas dele aparecem logo abaixo, em "Processo aberto")
  { rotulo: "Processos", href: "/processos", ativo: (c) => c === "/processos" || (c.startsWith("/processos/") && c !== "/processos/novo") },
  { rotulo: "Novo processo", href: "/processos/novo", ativo: (c) => c === "/processos/novo" },
  { rotulo: "Atualização do IPCA-E", href: "/ipca", ativo: (c) => c === "/ipca" },
];
const ADMINISTRACAO: Item[] = [
  { rotulo: "Dados da OM", href: "/om", ativo: (c) => c === "/om" },
  { rotulo: "Operadores", href: "/operadores", ativo: (c) => c === "/operadores" },
];

const classeItem = (ativo: boolean) =>
  `group flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${FOCO}
   ${ativo ? "bg-creme text-carvao shadow-[inset_3px_0_0_var(--color-ouro)]" : "text-creme/85 hover:bg-white/10 hover:text-white"}`;

function Conteudo({ admin, usuario }: { admin: boolean; usuario: string }) {
  const caminho = usePathname();
  const { processo } = useContext(Contexto);
  // (na prévia de desenvolvimento, /dev/previa, o processo fictício também aparece)
  const naPrevia = process.env.NODE_ENV === "development" && caminho === "/dev/previa";
  const aberto = processo && (caminho.startsWith(`/processos/${processo.id}/`) || naPrevia) ? processo : null;
  const ativa = abaAtiva(caminho);

  const link = (i: Item) => (
    <li key={i.href}>
      <Link href={i.href} prefetch={false} aria-current={i.ativo(caminho) ? "page" : undefined} className={classeItem(i.ativo(caminho))}>{i.rotulo}</Link>
    </li>
  );
  const abaDoProcesso = (a: Aba, marcador: React.ReactNode) => {
    const eAtiva = a === ativa;
    return (
      <li key={a.caminho}>
        <Link href={`/processos/${aberto!.id}/${a.caminho}`} prefetch={false} aria-current={eAtiva ? "page" : undefined}
          className={`group flex items-center gap-2.5 py-1.5 pl-1.5 pr-2 text-[13px] font-medium transition-colors motion-reduce:transition-none ${FOCO}
            ${eAtiva ? "bg-creme text-carvao shadow-[inset_3px_0_0_var(--color-ouro)]" : "text-creme/85 hover:bg-white/10 hover:text-white"}`}>
          {marcador}
          <span className="leading-tight">{a.rotulo}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* marca no estilo do cabeçalho do portal: brasão, nome em itálico e a Divisão em dourado */}
      <Link href="/passo-a-passo" className={`mb-5 flex items-center gap-3 border-b border-white/10 px-1.5 pb-4 pt-1 ${FOCO}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brasao-badm.png" alt="Brasão da B Adm Gu Natal" className="h-12 w-auto shrink-0 object-contain" />
        <span className="min-w-0">
          <span className="block font-marca text-[15px] italic leading-tight text-white">Exercícios Anteriores</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-ouro-claro">Div Pg Pes · B Adm Gu Natal</span>
        </span>
      </Link>

      <nav aria-label="Menu principal" className="flex-1 space-y-5 overflow-y-auto [scrollbar-width:thin]">
        <ul className="space-y-0.5">{PRINCIPAIS.map(link)}</ul>
        {admin && (
          <div>
            <p id="lat-admin" className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-ouro-claro">Administração</p>
            <ul aria-labelledby="lat-admin" className="space-y-0.5">{ADMINISTRACAO.map(link)}</ul>
          </div>
        )}
          {aberto && (
            <section aria-label="Processo aberto" className="bg-black/15 p-2 ring-1 ring-white/10">
              <div className="flex flex-col gap-1 px-1 pb-2">
                <p className="text-[13px] font-bold leading-snug text-white">{aberto.titulo}</p>
                <p className="text-[11px] leading-snug text-ouro-claro">{aberto.subtitulo}</p>
                <SeloSituacao situacao={aberto.situacao} />
              </div>
              <div className="space-y-2 border-t border-white/10 pt-2" aria-label="Abas do processo" role="group">
                <p id="lat-lancamentos" className="px-1 text-[10px] font-semibold uppercase tracking-[.14em] text-ouro-claro">Lançamentos</p>
                {/* linha vertical ligando as etapas, atrás dos números */}
                <ol aria-labelledby="lat-lancamentos" className="relative space-y-0.5 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-ouro-claro/30">
                  {LANCAMENTOS.map((a, i) => abaDoProcesso(a, <Numero n={i + 1} ativa={a === ativa} />))}
                </ol>
                <p id="lat-documentos" className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[.14em] text-ouro-claro">Documentos</p>
                <ul aria-labelledby="lat-documentos" className="space-y-0.5">
                  {DOCUMENTOS.map((a) => abaDoProcesso(a, <Ponto />))}
                </ul>
              </div>
            </section>
          )}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="truncate px-2.5 text-xs font-medium text-white">{usuario}</p>
        <p className="px-2.5 pb-2 text-[11px] text-ouro-claro">{admin ? "Admin" : "Operador"}</p>
        <form action={sair}>
          <button className={`w-full px-2.5 py-2 text-left text-sm text-creme/85 hover:bg-white/10 hover:text-white ${FOCO}`}>Sair</button>
        </form>
      </div>
    </div>
  );
}

/**
 * Barra lateral do sistema. Computador: fixa à esquerda, com o menu, as abas do processo aberto e o usuário.
 * Celular: barra no topo com botão que abre o mesmo menu.
 */
export function BarraLateral({ admin, usuario }: { admin: boolean; usuario: string }) {
  const [aberta, setAberta] = useState(false);
  const caminho = usePathname();
  useEffect(() => setAberta(false), [caminho]);
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r-2 border-ouro bg-exercito p-3 text-creme/85 lg:block print:hidden">
        <Conteudo admin={admin} usuario={usuario} />
      </aside>

      {/* celular: barra no topo e menu em gaveta */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-ouro bg-exercito px-4 text-white lg:hidden print:hidden">
        <Link href="/passo-a-passo" className="font-marca text-[15px] italic">Exercícios Anteriores</Link>
        <button type="button" onClick={() => setAberta(true)} aria-expanded={aberta} aria-controls="menu-celular"
          className={` px-3 py-1.5 text-sm ring-1 ring-white/25 hover:bg-white/10 ${FOCO}`}>Menu</button>
      </div>
      {aberta && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/40" onClick={() => setAberta(false)} />
          <div id="menu-celular" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r-2 border-ouro bg-exercito p-3 text-creme/85 shadow-xl">
            <Conteudo admin={admin} usuario={usuario} />
          </div>
        </div>
      )}
    </>
  );
}
