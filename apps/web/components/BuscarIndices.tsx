"use client";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { buscarIndicesAgora, type ResultadoColeta } from "@/lib/acoes/ipca";

/** Botão que busca os índices na hora, sem esperar a rotina diária. */
export function BuscarIndices() {
  const [res, setRes] = useState<ResultadoColeta | null>(null);
  const [ocupado, iniciar] = useTransition();
  return (
    <section className="cartao flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <h2 className="font-semibold">Buscar índices agora</h2>
        <p className="text-sm text-suave">Use quando o IBGE já tiver publicado o mês e a rotina diária ainda não tiver rodado.</p>
      </div>
      <button className="botao" disabled={ocupado} onClick={() => iniciar(async () => setRes(await buscarIndicesAgora()))}>
        {ocupado ? "Buscando…" : "Buscar índices agora"}
      </button>
      {res?.erro && <div className="w-full"><Aviso tipo="erro">{res.erro}</Aviso></div>}
      {res?.mensagem && <div className="w-full"><Aviso tipo="ok">{res.mensagem}</Aviso></div>}
    </section>
  );
}
