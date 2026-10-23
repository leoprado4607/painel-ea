"use client";
import { useEffect, useRef } from "react";

const DURACAO = 10000;

/** Pop-up depois do preenchimento automático pelos PDFs: conferir os dados bancários com o Requerimento. Centralizado, some em 10 s. */
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
    <div className="fixed inset-0 z-50 grid place-items-center px-4 print:hidden">
      {/* fundo escurecido: clicar fora também fecha */}
      <button type="button" aria-label="Fechar aviso" tabIndex={-1} onClick={aoFechar} className="absolute inset-0 cursor-default bg-black/50" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="aviso-banco-titulo" aria-describedby="aviso-banco-texto"
        className="relative w-full max-w-lg overflow-hidden border-2 border-amber-800/70 bg-amber-50 text-amber-900 shadow-[0_24px_60px_-16px_rgba(0,0,0,.6)] motion-safe:animate-[surgir_.2s_ease-out]">
        <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-7 text-center">
          <span aria-hidden className="grid h-14 w-14 place-items-center rounded-full border-2 border-amber-800/70 bg-amber-100 text-3xl font-bold leading-none">!</span>
          <p id="aviso-banco-titulo" className="text-xl font-bold uppercase tracking-[.06em]">Atenção Operador!</p>
          <p id="aviso-banco-texto" className="text-base leading-relaxed">
            Verifique se os <strong>dados bancários</strong> do formulário conferem com os dados bancários do <strong>Requerimento</strong>.
          </p>
          <button ref={fechar} type="button" onClick={aoFechar}
            className="mt-2 border-2 border-amber-800/70 bg-amber-100 px-6 py-2 text-sm font-bold hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ouro">
            Entendi
          </button>
        </div>
        {/* tempo restante até fechar sozinho */}
        <div aria-hidden className="h-1.5 origin-left bg-amber-800/70 motion-safe:animate-[encolher_10s_linear_forwards]" />
      </div>
    </div>
  );
}
