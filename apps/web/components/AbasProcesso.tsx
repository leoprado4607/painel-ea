"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ABAS, abaAtiva } from "@/lib/abas";

const LANCAMENTOS = ABAS.filter((a) => a.grupo === "lancamento");
const DOCUMENTOS = ABAS.filter((a) => a.grupo === "documento");
const SITUACAO = {
  rascunho: { rotulo: "Rascunho", classe: "bg-amber-200/90 text-amber-950" },
  emitido: { rotulo: "Emitido", classe: "bg-[#c9a24a] text-[#2a2410]" },
  arquivado: { rotulo: "Arquivado", classe: "bg-white/20 text-white" },
} as const;

/**
 * "Capa" do processo, fixa no topo: quem é o favorecido, a situação e as abas do processo.
 * Lançamentos são uma sequência (numerados 1–4); documentos não têm ordem (marcados com um ponto latão).
 */
export function AbasProcesso({ id, titulo, subtitulo, situacao }: {
  id: string; titulo: string; subtitulo: string; situacao: keyof typeof SITUACAO;
}) {
  const ativa = abaAtiva(usePathname());
  const ativaRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ativaRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduzir ? "auto" : "smooth" });
  }, [ativa]);

  const aba = (a: (typeof ABAS)[number], marcador: React.ReactNode) => {
    const eAtiva = a === ativa;
    return (
      <li key={a.caminho} className="shrink-0 snap-start">
        <Link ref={eAtiva ? ativaRef : undefined} href={`/processos/${id}/${a.caminho}`} prefetch={false}
          aria-current={eAtiva ? "page" : undefined}
          className={`group flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium outline-none transition-colors
            focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none
            ${eAtiva ? "bg-white text-tinta shadow-[0_1px_0_rgba(0,0,0,.25),0_6px_16px_-6px_rgba(0,0,0,.45)]" : "text-[#dfe7d6] hover:bg-white/10 hover:text-white"}`}>
          {marcador}
          {a.rotulo}
        </Link>
      </li>
    );
  };

  return (
    <div className="sticky top-2 z-20 rounded-2xl bg-[#2e431d] text-[#dfe7d6] shadow-[0_10px_30px_-12px_rgba(29,36,32,.6)] ring-1 ring-black/10 print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 pt-3 sm:px-5">
        <Link href="/processos" className="rounded text-xs font-medium text-[#a8c48a] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/80">
          ← Processos
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-white">{titulo}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SITUACAO[situacao].classe}`}>{SITUACAO[situacao].rotulo}</span>
        <p className="w-full truncate text-xs text-[#a8c48a]">{subtitulo}</p>
      </div>
      <nav aria-label="Abas do processo"
        className="overflow-x-auto px-2 pb-2.5 [mask-image:linear-gradient(90deg,transparent,#000_12px,#000_calc(100%-12px),transparent)] [scrollbar-width:none] sm:px-3 lg:overflow-visible lg:[mask-image:none]">
        <div className="flex w-max items-center gap-3 px-1 lg:w-auto lg:flex-col lg:items-stretch lg:gap-1.5">
          <div className="flex items-center gap-2">
          <span id="grupo-lancamentos" className="pl-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[#a8c48a] lg:w-24">Lançamentos</span>
          <ol className="flex snap-x items-center gap-1" aria-labelledby="grupo-lancamentos">
            {LANCAMENTOS.map((a, i) => aba(a,
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold tabular-nums ${a === ativa ? "bg-[#3b5625] text-white" : "bg-[#a8c48a]/20 text-[#a8c48a] group-hover:bg-[#a8c48a]/30"}`}>
                {i + 1}
              </span>))}
          </ol>
          </div>
          <span aria-hidden className="h-6 w-px bg-white/15 lg:hidden" />
          <div className="flex items-center gap-2 lg:border-t lg:border-white/10 lg:pt-1.5">
          <span id="grupo-documentos" className="pl-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[#c9a24a] lg:w-24">Documentos</span>
          <ul className="flex snap-x items-center gap-1" aria-labelledby="grupo-documentos">
            {DOCUMENTOS.map((a) => aba(a, <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#c9a24a]" />))}
          </ul>
          </div>
        </div>
      </nav>
    </div>
  );
}
