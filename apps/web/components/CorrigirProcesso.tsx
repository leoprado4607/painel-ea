"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reabrirProcesso } from "@/lib/acoes/emissao";

/**
 * "Corrigir" (card de processo emitido e aba Impressão): volta a rascunho para editar tudo, sem apagar nada do que foi
 * lançado. Só aparece para quem emitiu a última versão (o banco também barra os demais).
 */
export function CorrigirProcesso({ id, descricao, classe = "botao-sec min-w-[5.5rem] py-1.5" }: { id: string; descricao: string; classe?: string }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const corrigir = () => {
    if (!confirm(`Corrigir o processo ${descricao}? Ele volta a rascunho com todas as informações já registradas e pode ser editado por completo; os PDFs emitidos continuam guardados. Para valer, emita de novo na aba Impressão (nova versão).`)) return;
    iniciar(async () => {
      const r = await reabrirProcesso(id);
      if ("erro" in r) return setErro(r.erro ?? "Não foi possível reabrir o processo.");
      router.push(`/processos/${id}/dados`);
    });
  };
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={corrigir} disabled={ocupado} aria-label={`Corrigir o processo ${descricao}`} className={classe}>
        {ocupado ? "Abrindo…" : "Corrigir"}
      </button>
      {erro && <p role="alert" className="max-w-48 text-right text-xs text-red-800">{erro}</p>}
    </div>
  );
}
