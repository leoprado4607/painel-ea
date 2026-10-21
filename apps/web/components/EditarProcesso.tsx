"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reabrirProcesso } from "@/lib/acoes/emissao";

/** Botão do card de processo emitido: volta a rascunho para reeditar, sem apagar nada do que foi lançado. */
export function EditarProcesso({ id, descricao }: { id: string; descricao: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const editar = () => {
    if (!confirm(`Editar o processo ${descricao}? Ele volta a rascunho com todas as informações já registradas; os PDFs emitidos continuam guardados. Para valer, emita de novo na aba Impressão.`)) return;
    iniciar(async () => {
      const r = await reabrirProcesso(id);
      if ("erro" in r) return setErro(r.erro ?? "Não foi possível reabrir o processo.");
      router.push(`/processos/${id}/dados`);
    });
  };
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={editar} disabled={ocupado} aria-label={`Editar o processo ${descricao}`} className="botao-sec min-w-[5.5rem] py-1.5">
        {ocupado ? "Abrindo…" : "Editar"}
      </button>
      {erro && <p role="alert" className="max-w-48 text-right text-xs text-red-800">{erro}</p>}
    </div>
  );
}
