"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ABAS, abaAtiva } from "@/lib/abas";

/**
 * Abas do sistema no rodapé, no estilo das guias do Excel (Passo a passo, IPCA-E, Dados da OM, Operadores).
 * As abas do processo ficam na barra lateral do processo (AbasProcesso).
 */
export function AbasRodape({ admin }: { admin: boolean }) {
  const ativa = abaAtiva(usePathname());
  const abas = ABAS.filter((a) => !a.doProcesso && (!a.soAdmin || admin));
  return (
    <nav aria-label="Abas do sistema" className="fixed inset-x-0 bottom-0 z-30 h-[var(--altura-abas)] border-t border-borda bg-[#e6e9e4] print:hidden">
      <div className="mx-auto flex h-full max-w-7xl items-start overflow-x-auto px-2 [scrollbar-width:thin]">
        {abas.map((aba) => {
          const eAtiva = ativa === aba;
          return (
            // sem pré-carregamento: cada aba processa a página inteira no servidor (sessão e banco)
            <Link key={aba.caminho} href={aba.caminho} prefetch={false} aria-current={eAtiva ? "page" : undefined}
              className={`relative flex h-9 shrink-0 items-center whitespace-nowrap border-r border-borda px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marca-600
                ${eAtiva ? "-mt-px bg-white font-semibold text-tinta shadow-[0_-1px_0_var(--color-borda)]" : "text-suave hover:bg-white/60 hover:text-tinta"}`}>
              {aba.rotulo}
              <span aria-hidden className={`absolute inset-x-0 bottom-0 bg-[#8a948e] ${eAtiva ? "h-1" : "h-[3px] opacity-60"}`} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
