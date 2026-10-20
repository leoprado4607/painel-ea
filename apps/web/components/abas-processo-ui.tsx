/** Peças visuais das abas do processo, usadas na barra lateral (computador) e na tira de abas (celular). */
import { ABAS } from "@/lib/abas";

export const LANCAMENTOS = ABAS.filter((a) => a.grupo === "lancamento");
export const DOCUMENTOS = ABAS.filter((a) => a.grupo === "documento");

export const SITUACAO = {
  rascunho: { rotulo: "Rascunho", classe: "bg-amber-200/90 text-amber-950" },
  emitido: { rotulo: "Emitido", classe: "bg-ouro-claro text-carvao" },
  arquivado: { rotulo: "Arquivado", classe: "bg-white/20 text-white" },
} as const;
export type SituacaoProcesso = keyof typeof SITUACAO;

export const FOCO = "outline-none focus-visible:ring-2 focus-visible:ring-white/80";

/** Número da etapa (lançamentos são uma sequência). */
export function Numero({ n, ativa }: { n: number; ativa: boolean }) {
  return (
    <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ring-4 ring-exercito
      ${ativa ? "bg-ouro text-white" : "bg-white/10 text-ouro-claro group-hover:bg-white/15"}`}>{n}</span>
  );
}

/** Marcador dos documentos (sem ordem). */
export const Ponto = () => <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center"><span className="h-1.5 w-1.5 rounded-full bg-ouro-claro" /></span>;

export function SeloSituacao({ situacao }: { situacao: SituacaoProcesso }) {
  return <span className={`w-fit shrink-0 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.05em] ${SITUACAO[situacao].classe}`}>{SITUACAO[situacao].rotulo}</span>;
}
