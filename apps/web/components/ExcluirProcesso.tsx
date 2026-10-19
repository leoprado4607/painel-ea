"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { excluirProcesso } from "@/lib/acoes/processo";

/** Botão do Admin para excluir um processo, com confirmação do que será apagado. */
export function ExcluirProcesso({ id, descricao, emitido }: { id: string; descricao: string; emitido: boolean }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const excluir = () => {
    const aviso = emitido
      ? `Excluir o processo ${descricao}? Ele já foi EMITIDO: os PDFs guardados também serão apagados. Não é possível desfazer.`
      : `Excluir o processo ${descricao}? Os valores lançados serão apagados. Não é possível desfazer.`;
    if (!confirm(aviso)) return;
    iniciar(async () => {
      const r = await excluirProcesso(id);
      if (r.erro) return setErro(r.erro);
      router.refresh();
    });
  };
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={excluir} disabled={ocupado} aria-label={`Excluir o processo ${descricao}`}
        className="botao-sec py-1.5 text-red-800 hover:border-red-300 hover:bg-red-50">
        {ocupado ? "Excluindo…" : "Excluir"}
      </button>
      {erro && <p role="alert" className="max-w-48 text-right text-xs text-red-800">{erro}</p>}
    </div>
  );
}
