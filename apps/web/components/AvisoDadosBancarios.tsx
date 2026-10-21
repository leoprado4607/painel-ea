"use client";
import { useEffect, useRef } from "react";

const DURACAO = 5000;

/** Pop-up depois do preenchimento automático pelos PDFs: conferir os dados bancários com o Requerimento. Some em 5 s. */
export function AvisoDadosBancarios({ aoFechar }: { aoFechar: () => void }) {
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const t = setTimeout(aoFechar, DURACAO);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [aoFechar]);
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 print:hidden">
      <div role="alertdialog" aria-labelledby="aviso-banco-titulo" aria-describedby="aviso-banco-texto"
        className="relative w-full max-w-md overflow-hidden border border-amber-200 bg-amber-50 text-amber-900 shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)]">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            <p id="aviso-banco-titulo" className="font-bold">Atenção Operador!</p>
            <p id="aviso-banco-texto">Verifique se os dados bancários do formulário conferem com os dados bancários do Requerimento.</p>
          </div>
          <button ref={fechar} type="button" onClick={aoFechar}
            className="shrink-0 border border-amber-200 px-2.5 py-1 text-xs font-semibold hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-ouro">
            Fechar
          </button>
        </div>
        {/* tempo restante até fechar sozinho */}
        <div aria-hidden className="h-1 origin-left bg-amber-800/60 motion-safe:animate-[encolher_5s_linear_forwards]" />
      </div>
    </div>
  );
}
