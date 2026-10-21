import { PARECER_PADRAO } from "@painel-ea/documentos";
import { AbaDocumento } from "@/components/AbaDocumento";
import Link from "next/link";
import { textoBoletim } from "@/lib/averbacao";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Solicitação verso": requerimento e parecer (documento que materializa o direito, boletim e explicação: em Informações). */
export default async function SolicitacaoVerso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const c = processo.complementos ?? {};
  return (
    <AbaDocumento processoId={id} doc="solicitacao" bloqueado={bloqueado} observacao={
      <section className="cartao space-y-1 text-sm">
        <h2 className="font-semibold">Boletim que averbou</h2>
        <p>{textoBoletim(processo) || <span className="text-suave">Não informado.</span>}</p>
        <p className="ajuda">Altere em <Link href={`/processos/${id}/dados`} className="underline">Informações</Link> (Averbação).</p>
        <p className="ajuda pt-2">
          O documento que materializa o direito e a explicação do não pagamento à época também são preenchidos em{" "}
          <Link href={`/processos/${id}/dados`} className="underline">Informações</Link>.
        </p>
      </section>
    } grupos={[
      { titulo: "Requerimento", campos: [
        { nome: "data_requerimento", rotulo: "Data do requerimento", tipo: "date", valor: processo.data_requerimento, largo: true },
      ] },
      { titulo: "Parecer", campos: [
        { nome: "c.parecer", rotulo: "Parecer", tipo: "textarea", valor: c.parecer, placeholder: PARECER_PADRAO, ajuda: "Vazio: usa o texto padrão." },
      ] },
    ]} />
  );
}
