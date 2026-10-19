"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { emitirDocumentos, reabrirProcesso } from "@/lib/acoes/emissao";

interface Doc { id: string; versao: number; criado_em: string; indice_ate: string | null; tamanho_bytes: number | null }

export function PainelEmissao({ processoId, situacao, documentos }: { processoId: string; situacao: string; documentos: Doc[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const emitir = () => {
    if (!confirm("Emitir os documentos? O PDF fica guardado e o processo é travado (para alterar, será preciso reabrir e emitir nova versão).")) return;
    iniciar(async () => {
      const r = await emitirDocumentos(processoId);
      if ("erro" in r && r.erro) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "ok", texto: "Documentos emitidos e guardados." });
      router.refresh();
    });
  };
  const reabrir = () => {
    if (!confirm("Reabrir o processo para correção? Os PDFs já emitidos continuam guardados.")) return;
    iniciar(async () => {
      const r = await reabrirProcesso(processoId);
      if ("erro" in r && r.erro) return setMsg({ tipo: "erro", texto: r.erro });
      router.refresh();
    });
  };
  const data = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <section className="cartao space-y-3">
      <h2 className="font-semibold">Documentos</h2>
      <p className="text-sm text-suave">
        Pacote completo em PDF: Solicitação de Pagamento e Verso; Solicitação, Verso e Comprovação (recebido e devido) de cada ano; Recapitulação, CPEX e Resumo.
      </p>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <a className="botao-sec" href={`/processos/${processoId}/previa`} target="_blank" rel="noopener">Ver prévia (PDF)</a>
        {situacao === "rascunho"
          ? <button className="botao" disabled={ocupado} onClick={emitir}>{ocupado ? "Emitindo…" : "Emitir documentos"}</button>
          : <button className="botao-sec" disabled={ocupado} onClick={reabrir}>Reabrir para correção</button>}
      </div>
      {documentos.length > 0 && (
        <ul className="divide-y divide-borda rounded-md border border-borda text-sm">
          {documentos.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <strong>Versão {d.versao}</strong> · emitida em {data(d.criado_em)}
                {d.indice_ate ? ` · índice até ${d.indice_ate.slice(5, 7)}/${d.indice_ate.slice(0, 4)}` : ""}
              </span>
              <a className="text-marca-700 underline" href={`/processos/${processoId}/documentos/${d.id}`} target="_blank" rel="noopener">Abrir PDF</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
