"use client";
import { useCallback, useEffect, useState } from "react";
import { AvisoDadosBancarios } from "@/components/AvisoDadosBancarios";
import { EnvioDocumentos } from "@/components/EnvioDocumentos";
import { FormularioProcesso, type Valores } from "@/components/FormularioProcesso";
import type { DadosLidos } from "@/lib/favorecido";

/** Campos do formulário que as fichas (e, nos dados bancários, o contracheque) preenchem. */
const CAMPOS_DOS_PDFS: (keyof DadosLidos)[] = ["posto_graduacao", "nome", "prec_cp", "cpf", "identidade", "om_vinculacao", "banco", "agencia", "conta"];

/**
 * Aba "Informações": envie contracheques/fichas para preencher os dados (e os recebidos), ou digite no formulário.
 * Os dados lidos só vão para o formulário; o usuário confere e grava em "Salvar e continuar".
 */
export function DadosFavorecido({ processoId, valores, rubricas, bloqueado, conferirBanco = false }: {
  processoId: string; valores: Valores; rubricas: { posicao: number; codigo: string }[]; bloqueado: boolean;
  /** processo recém-criado pelos documentos (?conferir=banco): abre o aviso dos dados bancários */
  conferirBanco?: boolean;
}) {
  const [aviso, setAviso] = useState(conferirBanco);
  const fecharAviso = useCallback(() => setAviso(false), []);
  // tira o ?conferir=banco do endereço, para o aviso não voltar ao recarregar a página
  useEffect(() => { if (conferirBanco) window.history.replaceState(null, "", window.location.pathname); }, [conferirBanco]);
  const [lidos, setLidos] = useState<DadosLidos>({});
  const [versao, setVersao] = useState(0);
  const [envio, setEnvio] = useState(0); // reinicia só o envio de PDFs (no "Limpar"), não ao copiar os dados
  // "Limpar": em branco os campos que os PDFs preenchem, e descarta os documentos lidos (o envio recomeça do zero)
  const limpar = () => {
    setLidos(Object.fromEntries(CAMPOS_DOS_PDFS.map((c) => [c, ""])) as DadosLidos);
    setVersao((v) => v + 1);
    setEnvio((v) => v + 1);
  };
  return (
    <div className="space-y-5">
      <EnvioDocumentos key={`envio-${envio}`} processoId={processoId} rubricas={rubricas} bloqueado={bloqueado}
        aoLerDados={(d) => {
          // OM de vinculação: prioridade sempre do contracheque; a da ficha só preenche se o campo estiver vazio
          setLidos((antes) => {
            const atual = { ...valores, ...antes }.om_vinculacao;
            const { om_do_contracheque, ...dados } = d;
            if (!om_do_contracheque && atual) delete dados.om_vinculacao;
            return dados;
          });
          setVersao((v) => v + 1);
          setAviso(true);
        }} />
      {aviso && <AvisoDadosBancarios aoFechar={fecharAviso} />}
      {/* a chave remonta o formulário com os dados lidos por cima do cadastro */}
      <FormularioProcesso key={versao} processoId={processoId} valores={{ ...valores, ...lidos }} bloqueado={bloqueado} aoLimpar={limpar} />
    </div>
  );
}
