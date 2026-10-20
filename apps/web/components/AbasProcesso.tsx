"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { abaAtiva, type Aba } from "@/lib/abas";
import { DOCUMENTOS, FOCO, LANCAMENTOS, Numero, Ponto, SeloSituacao, type SituacaoProcesso } from "./abas-processo-ui";

/**
 * Celular e tablet: nome do processo e uma tira de abas com rolagem, fixa no topo.
 * No computador, as abas do processo ficam na barra lateral do sistema (BarraLateral).
 */
export function AbasProcesso({ id, titulo, subtitulo, situacao }: { id: string; titulo: string; subtitulo: string; situacao: SituacaoProcesso }) {
  const ativa = abaAtiva(usePathname());
  const ativaRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ativaRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduzir ? "auto" : "smooth" });
  }, [ativa]);

  const item = (a: Aba, marcador: React.ReactNode) => {
    const eAtiva = a === ativa;
    return (
      <li key={a.caminho} className="shrink-0">
        <Link ref={eAtiva ? ativaRef : undefined} href={`/processos/${id}/${a.caminho}`} prefetch={false} aria-current={eAtiva ? "page" : undefined}
          className={`group flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full pl-1 pr-3 text-[13px] font-medium ${FOCO}
            ${eAtiva ? "bg-white text-tinta" : "text-[#dfe7d6] hover:bg-white/10"}`}>
          {marcador}
          {a.rotulo}
        </Link>
      </li>
    );
  };

  return (
    <>
      <div className="flex items-center gap-3 lg:hidden print:hidden">
        <Link href="/processos" aria-label="Voltar para Processos" className="text-sm text-marca-700 hover:underline">←</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{titulo}</h1>
          <p className="truncate text-xs text-suave">{subtitulo}</p>
        </div>
        <SeloSituacao situacao={situacao} />
      </div>
      {/* irmã do cabeçalho (não dentro dele) para o "sticky" valer na página toda */}
      <nav aria-label="Abas do processo"
        className="sticky top-16 z-20 overflow-x-auto rounded-full bg-[#2e431d] p-1 shadow-[0_8px_20px_-10px_rgba(29,36,32,.7)] [mask-image:linear-gradient(90deg,transparent,#000_10px,#000_calc(100%-10px),transparent)] [scrollbar-width:none] lg:hidden print:hidden">
        <ul className="flex w-max items-center gap-1">
          {LANCAMENTOS.map((a, i) => item(a, <Numero n={i + 1} ativa={a === ativa} />))}
          <li aria-hidden className="mx-1 h-5 w-px shrink-0 bg-white/15" />
          {DOCUMENTOS.map((a) => item(a, <Ponto />))}
        </ul>
      </nav>
    </>
  );
}
