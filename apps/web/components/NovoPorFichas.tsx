"use client";
import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { EscolhaOm } from "@/components/FormularioProcesso";
import { criarProcessoDeFichas } from "@/lib/acoes/fichas";

/** Novo processo a partir das fichas: nome, CPF, Prec-CP, identidade, período e valores recebidos vêm do PDF. */
export function NovoPorFichas({ oms = [] }: { oms?: { id: string; nome: string }[] }) {
  const [estado, enviar, enviando] = useActionState(criarProcessoDeFichas, undefined);
  return (
    <section className="cartao space-y-3 border-marca-600">
      <h2 className="font-semibold">1. Envie as fichas financeiras (recomendado)</h2>
      <p className="text-sm text-suave">
        Selecione os PDFs das fichas do SIPPES dos anos da dívida. O site cria o processo com nome, CPF, Prec-CP, identidade e
        período lidos da ficha e já preenche os valores recebidos. Depois você confere tudo.
      </p>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <form action={enviar} className="flex flex-wrap items-end gap-3">
        {oms.length > 0 && <div className="w-full sm:w-72"><EscolhaOm oms={oms} id="om_id-fichas" /></div>}
        <label htmlFor="fichas-novo" className="sr-only">Arquivos PDF</label>
        <input id="fichas-novo" name="fichas" type="file" accept="application/pdf,.pdf" multiple required
          className="text-sm file:mr-3 file:rounded-md file:border file:border-borda file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        <button className="botao" disabled={enviando}>{enviando ? "Lendo e criando…" : "Criar processo pelas fichas"}</button>
      </form>
    </section>
  );
}
