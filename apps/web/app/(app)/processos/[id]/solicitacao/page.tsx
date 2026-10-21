import { AbaDocumento } from "@/components/AbaDocumento";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Solicitação": folha de rosto da Solicitação de Pagamento ao Ordenador de Despesas. */
export default async function Solicitacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const ini = Number(processo.periodo_inicio?.slice(0, 4) ?? 0), fim = Number(processo.periodo_fim?.slice(0, 4) ?? 0);
  const anos = ini && fim ? String(fim - ini + 1) : "1";
  const a = processo.complementos?.anexos ?? {};
  return (
    <AbaDocumento processoId={id} doc="solicitacao" bloqueado={bloqueado} grupos={[
      { titulo: "Numeração", campos: [
        { nome: "numero", rotulo: "Nº da solicitação", valor: processo.numero },
        { nome: "ano", rotulo: "Ano", tipo: "number", valor: processo.ano },
      ] },
      { titulo: "Anexos (quantidade)", campos: [
        { nome: "c.anexos.fichas", rotulo: "Ficha(s) Financeira(s)", tipo: "number", valor: a.fichas, placeholder: anos },
        { nome: "c.anexos.folhasCalculo", rotulo: "Folha(s) de Cálculo(s)", tipo: "number", valor: a.folhasCalculo, placeholder: anos },
        { nome: "c.anexos.recapitulacao", rotulo: "Folha(s) de Cálculo-Recapitulação", tipo: "number", valor: a.recapitulacao, placeholder: "1" },
        { nome: "c.anexos.comprovacao", rotulo: "Comprovação Valores Recebidos e a Receber", tipo: "number", valor: a.comprovacao, placeholder: "1" },
        { nome: "c.anexos.bi", rotulo: "Cópia do BI que concedeu o direito", tipo: "number", valor: a.bi, placeholder: "1",
          ajuda: "Vazio usa o número sugerido; 0 tira o item da lista." },
      ] },
    ]} />
  );
}
