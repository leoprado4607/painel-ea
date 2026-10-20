/** Peças visuais das abas do processo, usadas na barra lateral (computador) e na tira de abas (celular). */
import { ABAS } from "@/lib/abas";

export const LANCAMENTOS = ABAS.filter((a) => a.grupo === "lancamento");
export const DOCUMENTOS = ABAS.filter((a) => a.grupo === "documento");

export const SITUACAO = {
  rascunho: { rotulo: "Rascunho", classe: "bg-amber-200/90 text-amber-950" },
  emitido: { rotulo: "Emitido", classe: "bg-[#c9a24a] text-[#2a2410]" },
  arquivado: { rotulo: "Arquivado", classe: "bg-white/20 text-white" },
} as const;
export type SituacaoProcesso = keyof typeof SITUACAO;

export const FOCO = "outline-none focus-visible:ring-2 focus-visible:ring-white/80";

/** Número da etapa (lançamentos são uma sequência). */
export function Numero({ n, ativa }: { n: number; ativa: boolean }) {
  return (
    <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ring-4 ring-[#2e431d]
      ${ativa ? "bg-[#a8c48a] text-[#1d2a12]" : "bg-[#3d5528] text-[#a8c48a] group-hover:bg-[#4a6631]"}`}>{n}</span>
  );
}

/** Marcador dos documentos (sem ordem). */
export const Ponto = () => <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center"><span className="h-1.5 w-1.5 rounded-full bg-[#c9a24a]" /></span>;

export function SeloSituacao({ situacao }: { situacao: SituacaoProcesso }) {
  return <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SITUACAO[situacao].classe}`}>{SITUACAO[situacao].rotulo}</span>;
}
