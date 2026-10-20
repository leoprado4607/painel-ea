"use client";
import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { EscolhaOm } from "@/components/FormularioProcesso";
import { criarProcessoDeDocumentos } from "@/lib/acoes/fichas";

/** Novo processo pelos documentos: dados do favorecido, período e valores recebidos vêm do contracheque e/ou das fichas. */
export function NovoPorFichas({ oms = [] }: { oms?: { id: string; nome: string }[] }) {
  const [estado, enviar, enviando] = useActionState(criarProcessoDeDocumentos, undefined);
  return (
    <section className="cartao space-y-3 border-marca-600">
      <h2 className="font-semibold">1. Envie o contracheque e/ou as fichas financeiras (recomendado)</h2>
      <p className="text-sm text-suave">
        Selecione um ou mais PDFs. O site cria o processo com nome, Prec-CP, CPF, P/G, OM de vinculação, banco, agência e conta,
        o período e os valores recebidos. Os arquivos são lidos e descartados: nenhum PDF fica guardado. Depois você confere tudo.
      </p>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        {oms.length > 0 && <div className="w-full sm:w-72"><EscolhaOm oms={oms} id="om_id-documentos" /></div>}
        <label htmlFor="documentos-novo" className="sr-only">Arquivos PDF</label>
        <input id="documentos-novo" name="documentos" type="file" accept="application/pdf,.pdf" multiple required
          className="text-sm file:mr-3 file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        <button className="botao" disabled={enviando}>{enviando ? "Lendo e criando…" : "Criar processo pelos documentos"}</button>
      </form>
    </section>
  );
}
