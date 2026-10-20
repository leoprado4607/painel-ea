import { PARECER_PADRAO } from "@painel-ea/documentos";
import { AbaDocumento } from "@/components/AbaDocumento";
import Link from "next/link";
import { textoBoletim } from "@/lib/averbacao";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Solicitação verso": requerimento, documento que materializou o direito, boletim, explicação e parecer. */
export default async function SolicitacaoVerso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const c = processo.complementos ?? {};
  return (
    <AbaDocumento processoId={id} doc="solicitacao" bloqueado={bloqueado} observacao={
      <section className="cartao space-y-1 text-sm">
        <h2 className="font-semibold">Boletim que averbou</h2>
        <p>{textoBoletim(processo) || <span className="text-suave">Não informado.</span>}</p>
        <p className="ajuda">Altere em <Link href={`/processos/${id}/dados`} className="underline">Dados do favorecido</Link> (Averbação).</p>
      </section>
    } grupos={[
      { titulo: "Requerimento", campos: [
        { nome: "data_requerimento", rotulo: "Data do requerimento", tipo: "date", valor: processo.data_requerimento, largo: true },
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
