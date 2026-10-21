"use client";
import { useEffect, useRef } from "react";

export interface Pendencia { secao: string; campo: string }

/**
 * Campos obrigatórios ainda vazios, encontrados no formulário ao salvar (pelo "required" de cada campo).
 * Rótulo: o <label for> do campo ou, nos editores de texto, o rótulo "<nome>-rotulo"; seção: o título do quadro.
 */
export function pendenciasDoFormulario(form: HTMLFormElement): { pendencias: Pendencia[]; primeiro: HTMLElement | null } {
  const vazios = Array.from(form.elements).filter((el): el is HTMLInputElement =>
    "validity" in el && !(el as HTMLInputElement).disabled && (el as HTMLInputElement).validity.valueMissing);
  const limpar = (t: string | null | undefined) => (t ?? "").replace(/\*\s*$/, "").trim();
  const pendencias = vazios.map((el) => {
    const rotulo = (el.id && form.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || document.getElementById(`${el.name}-rotulo`);
    return { secao: limpar(el.closest("section, fieldset:not([disabled])")?.querySelector("h2, legend")?.textContent), campo: limpar(rotulo?.textContent) || el.name };
  });
  return { pendencias, primeiro: vazios[0] ?? null };
}

/** Pop-up com as informações pendentes de preenchimento. Só fecha pelo botão "Fechar" (ou Esc). */
export function PopupPendencias({ pendencias, aoFechar }: { pendencias: Pendencia[]; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogo.current?.showModal(); }, []);
  // agrupa por quadro, na ordem do formulário
  const grupos = pendencias.reduce<{ secao: string; campos: string[] }[]>((acc, p) => {
    const g = acc.find((x) => x.secao === p.secao);
    if (g) g.campos.push(p.campo); else acc.push({ secao: p.secao, campos: [p.campo] });
    return acc;
  }, []);
  return (
    <dialog ref={dialogo} onClose={aoFechar} aria-labelledby="pendencias-titulo"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] border border-amber-200 bg-white p-0 text-tinta shadow-[0_16px_40px_-12px_rgba(0,0,0,.5)] backdrop:bg-black/45">
      <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-amber-900">
        <h2 id="pendencias-titulo" className="font-sans text-base font-bold">Informações pendentes de preenchimento</h2>
        <p className="text-sm">Preencha {pendencias.length === 1 ? "o campo abaixo" : `os ${pendencias.length} campos abaixo`} antes de salvar.</p>
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4 text-sm">
        {grupos.map((g) => (
          <div key={g.secao}>
            {g.secao && <p className="font-semibold">{g.secao}</p>}
            <ul className="ml-5 list-disc text-suave">{g.campos.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        ))}
      </div>
      {/* div (não form method="dialog"): o pop-up fica dentro do formulário do processo */}
      <div className="flex justify-end border-t border-borda px-5 py-3">
        <button type="button" className="botao" autoFocus onClick={() => dialogo.current?.close()}>Fechar</button>
      </div>
    </dialog>
  );
}
