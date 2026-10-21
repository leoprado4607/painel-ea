import { AbaDocumento } from "@/components/AbaDocumento";
import { carregarProcesso } from "@/lib/processo";

/** Aba "CPEX": pensão judicial (o "operador que fará o lançamento" saiu do documento em 21/10/2026). */
export default async function Cpex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const pj = processo.complementos?.pensao ?? {};
  return (
    <AbaDocumento processoId={id} doc="cpex" bloqueado={bloqueado} grupos={[
      { titulo: "Pensão judicial (ZED)", campos: [
        { nome: "possui_pensao_judicial", rotulo: "Possui pensão judicial no período da dívida", tipo: "checkbox", valor: processo.possui_pensao_judicial },
        { nome: "c.pensao.nome", rotulo: "Nome do beneficiário", valor: pj.nome, largo: true },
        { nome: "c.pensao.cpf", rotulo: "CPF", valor: pj.cpf, placeholder: "000.000.000-00" },
        { nome: "c.pensao.banco", rotulo: "Banco", valor: pj.banco },
        { nome: "c.pensao.agencia", rotulo: "Agência", valor: pj.agencia },
        { nome: "c.pensao.conta", rotulo: "Conta corrente (com DV)", valor: pj.conta },
      ] },
    ]} />
  );
}
