import { PARECER_PADRAO } from "@painel-ea/documentos";
import { AbaDocumento } from "@/components/AbaDocumento";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Solicitação verso": requerimento, documento que materializou o direito, boletim, explicação e parecer. */
export default async function SolicitacaoVerso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const c = processo.complementos ?? {};
  return (
    <AbaDocumento processoId={id} doc="solicitacao" bloqueado={bloqueado} grupos={[
      { titulo: "Requerimento e boletim", campos: [
        { nome: "data_requerimento", rotulo: "Data do requerimento", tipo: "date", valor: processo.data_requerimento, largo: true },
        { nome: "bi_numero", rotulo: "Nº BI/Adt que averbou", valor: processo.bi_numero },
        { nome: "bi_data", rotulo: "Data do BI", tipo: "date", valor: processo.bi_data },
      ] },
      { titulo: "Textos do verso", campos: [
        { nome: "c.amparo", rotulo: "Nº/Data do documento que materializou o direito", tipo: "textarea", valor: c.amparo,
          placeholder: "Ex.: A solicitação encontra amparo nas Normas para o Pagamento de Despesas de Exercícios Anteriores… e no DIEx nº …" },
        { nome: "c.explicacao", rotulo: "Explicação do não pagamento à época devida", tipo: "textarea", valor: c.explicacao,
          placeholder: "Ex.: O militar … no período de … e não recebeu à época o valor referente a …" },
        { nome: "c.parecer", rotulo: "Parecer", tipo: "textarea", valor: c.parecer, placeholder: PARECER_PADRAO, ajuda: "Vazio: usa o texto padrão." },
      ] },
    ]} />
  );
}
