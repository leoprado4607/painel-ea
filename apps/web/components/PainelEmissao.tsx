"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { emitirDocumentos, reabrirProcesso } from "@/lib/acoes/emissao";
import { MSG_ADMIN_NAO_EMITE } from "@/lib/tipos";

interface Doc { id: string; versao: number; criado_em: string; indice_ate: string | null; tamanho_bytes: number | null;
  /** quem clicou para gerar o PDF ("Cb Fulano de Tal"); pode não ser quem criou o processo */
  emitido_por_nome?: string | null }

export function PainelEmissao({ processoId, situacao, documentos, somenteConsulta, ehAdmin }: {
  processoId: string; situacao: string; documentos: Doc[];
  /** processo de outro operador: vê a prévia e os PDFs, mas não emite nem reabre */
  somenteConsulta?: boolean;
  /** o Admin (Ordenador de Despesas) não emite: em rascunho, os botões só mostram o aviso */
  ehAdmin?: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const ultima = documentos[0];
  const enderecoPdf = (docId: string) => `/processos/${processoId}/documentos/${docId}`;
  const enderecoZip = (docId: string) => `/processos/${processoId}/documentos/${docId}/zip`;
  /**
   * "Imprimir compilado" (PDF único, numa aba nova) e "Download arquivos" (ZIP com cada documento em PDF separado).
   * Em rascunho, emite antes (guarda os dois e trava o processo); já emitido, usa a última versão.
   */
  const entregar = (forma: "compilado" | "arquivos") => {
    if (situacao !== "rascunho" && ultima) {
      if (forma === "compilado") window.open(enderecoPdf(ultima.id), "_blank", "noopener");
      else window.location.href = enderecoZip(ultima.id);
      return;
    }
    if (ehAdmin) { setMsg({ tipo: "erro", texto: MSG_ADMIN_NAO_EMITE }); alert(MSG_ADMIN_NAO_EMITE); return; }
    if (!confirm("Emitir os documentos? O PDF compilado e os arquivos separados ficam guardados e o processo é travado (para alterar, será preciso reabrir e emitir nova versão).")) return;
    // a aba do PDF é aberta já no clique (depois da emissão o navegador bloquearia)
    const aba = forma === "compilado" ? window.open("about:blank", "_blank") : null;
    iniciar(async () => {
      const r = await emitirDocumentos(processoId);
      if ("erro" in r && r.erro) { aba?.close(); return setMsg({ tipo: "erro", texto: r.erro }); }
      const docId = (r as { docId: string }).docId;
      if (forma === "compilado") { if (aba) aba.location.href = enderecoPdf(docId); else window.open(enderecoPdf(docId), "_blank"); }
      else window.location.href = enderecoZip(docId);
      setMsg({ tipo: "ok", texto: "Documentos emitidos e guardados (PDF compilado e arquivos separados)." });
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
        Pacote completo: Solicitação de Pagamento e Verso; Solicitação, Verso e Comprovação (recebido e devido) de cada ano; Recapitulação, CPEX e Resumo.
        “Imprimir compilado” abre um PDF único; “Download arquivos” baixa um ZIP com uma pasta e cada documento em PDF separado.
      </p>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <a className="botao-sec" href={`/processos/${processoId}/previa`} target="_blank" rel="noopener">Ver prévia (PDF)</a>
        {(situacao === "rascunho" ? !somenteConsulta : !!ultima) && (
          <>
            <button className="botao" disabled={ocupado} onClick={() => entregar("compilado")}>{ocupado ? "Emitindo…" : "Imprimir compilado"}</button>
            <button className="botao" disabled={ocupado} onClick={() => entregar("arquivos")}>{ocupado ? "Emitindo…" : "Download arquivos"}</button>
          </>
        )}
        {!somenteConsulta && situacao !== "rascunho" && <button className="botao-sec" disabled={ocupado} onClick={reabrir}>Reabrir para correção</button>}
      </div>
      {documentos.length > 0 && (
        <ul className="divide-y divide-borda border border-borda text-sm">
          {documentos.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <strong>Versão {d.versao}</strong> · emitida em {data(d.criado_em)}
                {d.emitido_por_nome ? ` por ${d.emitido_por_nome}` : ""}
                {d.indice_ate ? ` · índice até ${d.indice_ate.slice(5, 7)}/${d.indice_ate.slice(0, 4)}` : ""}
              </span>
              <span className="flex gap-4">
                <a className="text-marca-700 underline" href={enderecoPdf(d.id)} target="_blank" rel="noopener">Abrir PDF compilado</a>
                <a className="text-marca-700 underline" href={enderecoZip(d.id)}>Baixar arquivos (ZIP)</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
