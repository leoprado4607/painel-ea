import { AbaDocumento } from "@/components/AbaDocumento";
import { carregarProcesso } from "@/lib/processo";

/** Aba "CPEX": pensão judicial e operador que fará o lançamento no sistema. */
export default async function Cpex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const pj = processo.complementos?.pensao ?? {}, op = processo.complementos?.operadorCpex ?? {};
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
      { titulo: "Operador que fará o lançamento no sistema", campos: [
        { nome: "c.operadorCpex.nome", rotulo: "Nome/OP", valor: op.nome, largo: true },
        { nome: "c.operadorCpex.cpf", rotulo: "CPF", valor: op.cpf, placeholder: "000.000.000-00" },
      ] },
    ]} />
  );
}
