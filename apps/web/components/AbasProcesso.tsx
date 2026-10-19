"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ABAS, abaAtiva, type Aba } from "@/lib/abas";

const LANCAMENTOS = ABAS.filter((a) => a.grupo === "lancamento");
const DOCUMENTOS = ABAS.filter((a) => a.grupo === "documento");
const SITUACAO = {
  rascunho: { rotulo: "Rascunho", classe: "bg-amber-200/90 text-amber-950" },
  emitido: { rotulo: "Emitido", classe: "bg-[#c9a24a] text-[#2a2410]" },
  arquivado: { rotulo: "Arquivado", classe: "bg-white/20 text-white" },
} as const;

interface Props { id: string; titulo: string; subtitulo: string; situacao: keyof typeof SITUACAO }

/** Número da etapa (lançamentos são uma sequência). */
function Numero({ n, ativa }: { n: number; ativa: boolean }) {
  return (
    <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ring-4 ring-[#2e431d]
      ${ativa ? "bg-[#a8c48a] text-[#1d2a12]" : "bg-[#3d5528] text-[#a8c48a] group-hover:bg-[#4a6631]"}`}>{n}</span>
  );
}
const Ponto = () => <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center"><span className="h-1.5 w-1.5 rounded-full bg-[#c9a24a]" /></span>;

/**
 * Abas do processo. Computador: barra lateral fixa à esquerda, com o favorecido no alto, os lançamentos como
 * etapas ligadas por uma linha e os documentos abaixo. Celular: nome do processo e uma tira de abas com rolagem.
 */
export function AbasProcesso({ id, titulo, subtitulo, situacao }: Props) {
  const ativa = abaAtiva(usePathname());
  const ativaTiraRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ativaTiraRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduzir ? "auto" : "smooth" });
  }, [ativa]);
  const href = (a: Aba) => `/processos/${id}/${a.caminho}`;
  const foco = "outline-none focus-visible:ring-2 focus-visible:ring-white/80";
  const chip = <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SITUACAO[situacao].classe}`}>{SITUACAO[situacao].rotulo}</span>;

  const itemLateral = (a: Aba, marcador: React.ReactNode) => {
    const eAtiva = a === ativa;
    return (
      <li key={a.caminho}>
        <Link href={href(a)} prefetch={false} aria-current={eAtiva ? "page" : undefined}
          className={`group flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 text-[13px] font-medium transition-colors motion-reduce:transition-none ${foco}
            ${eAtiva ? "bg-white text-tinta shadow-[0_6px_16px_-8px_rgba(0,0,0,.6)]" : "text-[#dfe7d6] hover:bg-white/10 hover:text-white"}`}>
          {marcador}
          <span className="leading-tight">{a.rotulo}</span>
        </Link>
      </li>
    );
  };

  const itemTira = (a: Aba, marcador: React.ReactNode) => {
    const eAtiva = a === ativa;
    return (
      <li key={a.caminho} className="shrink-0">
        <Link ref={eAtiva ? ativaTiraRef : undefined} href={href(a)} prefetch={false} aria-current={eAtiva ? "page" : undefined}
          className={`group flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full pl-1 pr-3 text-[13px] font-medium ${foco}
            ${eAtiva ? "bg-white text-tinta" : "text-[#dfe7d6] hover:bg-white/10"}`}>
          {marcador}
          {a.rotulo}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* computador: barra lateral */}
      <aside className="sticky top-4 hidden self-start max-h-[calc(100vh-2rem-var(--altura-abas))] overflow-y-auto rounded-2xl bg-[#2e431d] p-3 text-[#dfe7d6] shadow-[0_10px_30px_-14px_rgba(29,36,32,.7)] [scrollbar-width:thin] lg:block print:hidden">
        <div className="flex flex-col gap-1.5 px-1.5 pb-3 pt-1">
          <Link href="/processos" className={`w-fit rounded text-xs font-medium text-[#a8c48a] hover:text-white ${foco}`}>← Processos</Link>
          <h1 className="text-[15px] font-bold leading-snug text-white">{titulo}</h1>
          <p className="text-xs leading-snug text-[#a8c48a]">{subtitulo}</p>
          {chip}
        </div>
        <nav aria-label="Abas do processo" className="space-y-3 border-t border-white/10 pt-3">
          <div>
            <p id="lat-lancamentos" className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#a8c48a]">Lançamentos</p>
            {/* linha vertical ligando as etapas, atrás dos números */}
            <ol aria-labelledby="lat-lancamentos" className="relative space-y-0.5 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-[#a8c48a]/25">
              {LANCAMENTOS.map((a, i) => itemLateral(a, <Numero n={i + 1} ativa={a === ativa} />))}
            </ol>
          </div>
          <div>
            <p id="lat-documentos" className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#c9a24a]">Documentos</p>
            <ul aria-labelledby="lat-documentos" className="space-y-0.5">
              {DOCUMENTOS.map((a) => itemLateral(a, <Ponto />))}
            </ul>
          </div>
        </nav>
      </aside>

      {/* celular e tablet: nome do processo e, como irmã (para "sticky" valer na página toda), a tira de abas */}
      <div className="flex items-center gap-3 lg:hidden print:hidden">
          <Link href="/processos" aria-label="Voltar para Processos" className="text-sm text-marca-700 hover:underline">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{titulo}</h1>
            <p className="truncate text-xs text-suave">{subtitulo}</p>
          </div>
          {chip}
      </div>
      <nav aria-label="Abas do processo"
          className="sticky top-2 z-20 lg:hidden print:hidden overflow-x-auto rounded-full bg-[#2e431d] p-1 shadow-[0_8px_20px_-10px_rgba(29,36,32,.7)] [mask-image:linear-gradient(90deg,transparent,#000_10px,#000_calc(100%-10px),transparent)] [scrollbar-width:none]">
          <ul className="flex w-max items-center gap-1">
            {LANCAMENTOS.map((a, i) => itemTira(a, <Numero n={i + 1} ativa={a === ativa} />))}
            <li aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/15" />
            {DOCUMENTOS.map((a) => itemTira(a, <Ponto />))}
          </ul>
      </nav>
    </>
  );
}
