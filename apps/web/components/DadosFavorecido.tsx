"use client";
import { useState } from "react";
import { EnvioDocumentos } from "@/components/EnvioDocumentos";
import { FormularioProcesso, type Valores } from "@/components/FormularioProcesso";
import type { DadosLidos } from "@/lib/favorecido";

/**
 * Aba "Dados do favorecido": envie contracheques/fichas para preencher os dados (e os recebidos), ou digite no formulário.
 * Os dados lidos só vão para o formulário; o usuário confere e grava em "Salvar e continuar".
 */
export function DadosFavorecido({ processoId, valores, rubricas, bloqueado }: {
  processoId: string; valores: Valores; rubricas: { posicao: number; codigo: string }[]; bloqueado: boolean;
}) {
  const [lidos, setLidos] = useState<DadosLidos>({});
  const [versao, setVersao] = useState(0);
  return (
    <div className="space-y-5">
      <EnvioDocumentos processoId={processoId} rubricas={rubricas} bloqueado={bloqueado}
        aoLerDados={(d) => { setLidos(d); setVersao((v) => v + 1); }} />
      {/* a chave remonta o formulário com os dados lidos por cima do cadastro */}
      <FormularioProcesso key={versao} processoId={processoId} valores={{ ...valores, ...lidos }} bloqueado={bloqueado} />
    </div>
  );
}
