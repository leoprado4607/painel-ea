"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ABAS, abaAtiva, enderecoAba, processoDoCaminho, type GrupoAba } from "@/lib/abas";

/** Cor da aba, como a "cor da guia" do Excel: diz a que grupo a aba pertence. */
const COR: Record<GrupoAba, string> = { sistema: "#8a948e", lancamento: "#4a6b2f", documento: "#a67c2e" };
const CHAVE = "painel-ea:processo";

interface ProcessoLembrado { id: string; nome: string }

/** Guarda o processo aberto, para as abas do processo continuarem apontando para ele nas abas do sistema. */
export function LembrarProcesso({ id, nome }: ProcessoLembrado) {
  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify({ id, nome })); } catch { /* navegação privada: só não lembra */ }
  }, [id, nome]);
  return null;
}

export function AbasRodape({ admin }: { admin: boolean }) {
  const caminho = usePathname();
  const ativa = abaAtiva(caminho);
  const [lembrado, setLembrado] = useState<ProcessoLembrado | null>(null);
  const ativaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as ProcessoLembrado | null;
      setLembrado(salvo?.id ? salvo : null);
    } catch { setLembrado(null); }
  }, [caminho]);

  useEffect(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ativaRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduzir ? "auto" : "smooth" });
  }, [caminho]);

  const processoId = processoDoCaminho(caminho) ?? lembrado?.id ?? null;
  const nomeProcesso = processoDoCaminho(caminho) === lembrado?.id || !processoDoCaminho(caminho) ? lembrado?.nome : null;
  const abas = ABAS.filter((a) => !a.soAdmin || admin);

  return (
    <nav aria-label="Abas" className="fixed inset-x-0 bottom-0 z-30 h-[var(--altura-abas)] border-t border-borda bg-[#e6e9e4] print:hidden">
      <div className="mx-auto flex h-full max-w-6xl items-start overflow-x-auto px-2 [scrollbar-width:thin]">
        {abas.map((aba, i) => {
          const href = enderecoAba(aba, processoId);
          const eAtiva = ativa === aba;
          const inicioGrupo = i > 0 && abas[i - 1]!.doProcesso !== aba.doProcesso;
          const conteudo = (
            <>
              {aba.rotulo}
              <span aria-hidden className={`absolute inset-x-0 bottom-0 ${eAtiva ? "h-1" : "h-[3px] opacity-60"}`} style={{ background: COR[aba.grupo] }} />
            </>
          );
          const base = "relative flex h-9 shrink-0 items-center whitespace-nowrap border-r border-borda px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marca-600";
          return (
            <div key={aba.rotulo} className="flex shrink-0 items-end">
              {inicioGrupo && (
                <span className="flex h-9 shrink-0 items-center gap-1 border-l-2 border-r border-borda border-l-suave/40 pl-3 pr-2 text-[11px] font-semibold uppercase tracking-wide text-suave"
                  title={nomeProcesso ?? undefined}>
                  {processoId ? <>Processo<span className="hidden max-w-40 truncate normal-case tracking-normal sm:inline">{nomeProcesso ? `· ${nomeProcesso}` : ""}</span></> : "Processo"}
                </span>
              )}
              {/* sem pré-carregamento: cada aba processa a página inteira no servidor (sessão e banco) */}
              {href ? (
                <Link ref={eAtiva ? ativaRef : undefined} href={href} prefetch={false} aria-current={eAtiva ? "page" : undefined}
                  className={`${base} ${eAtiva ? "-mt-px bg-white font-semibold text-tinta shadow-[0_-1px_0_var(--color-borda)]" : "text-suave hover:bg-white/60 hover:text-tinta"}`}>
                  {conteudo}
                </Link>
              ) : (
                <span aria-disabled title="Abra um processo para usar esta aba" className={`${base} cursor-not-allowed text-suave/50`}>{conteudo}</span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
