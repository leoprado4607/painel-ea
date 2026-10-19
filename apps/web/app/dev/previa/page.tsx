import { notFound } from "next/navigation";
import { AbaDocumento } from "@/components/AbaDocumento";
import { AbasRodape } from "@/components/AbasRodape";
import { FormularioProcesso } from "@/components/FormularioProcesso";
import { ValoresMensais } from "@/components/ValoresMensais";

/** Prévia das telas com dados fictícios, para conferir o visual sem banco. Só existe em desenvolvimento. */
export default async function Previa({ searchParams }: { searchParams: Promise<{ tela?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela } = await searchParams;
  const rubricas = [
    { posicao: 1, codigo: "A01 - SOLDO", tipo: "Receita" as const },
    { posicao: 2, codigo: "A03 - ADIC HAB", tipo: "Receita" as const },
    { posicao: 6, codigo: "AD2 - ADICIONAL FÉRIAS", tipo: "Receita" as const },
    { posicao: 13, codigo: "Z01 - FUSEX", tipo: "Despesa" as const },
    { posicao: 14, codigo: "Z02 - P MIL 7,5/9,5/10,5%", tipo: "Despesa" as const },
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {tela === "abas" ? (
        <div className="pb-16">
          <AbaDocumento processoId="00000000-0000-0000-0000-000000000000" doc="cpex" bloqueado={false} grupos={[
            { titulo: "Pensão judicial (ZED)", campos: [
              { nome: "possui_pensao_judicial", rotulo: "Possui pensão judicial no período da dívida", tipo: "checkbox", valor: true },
              { nome: "c.pensao.nome", rotulo: "Nome do beneficiário", valor: "Maria de Teste", largo: true },
              { nome: "c.pensao.cpf", rotulo: "CPF", placeholder: "000.000.000-00" },
            ] },
          ]} />
          <AbasRodape admin />
        </div>
      ) : tela === "valores" ? (
        <ValoresMensais processoId="previa" tipo="devido" proximaEtapa="conferencia" bloqueado={false} rubricas={rubricas}
          inicio={{ ano: 2020, mes: 11 }} fim={{ ano: 2021, mes: 6 }}
          linhas={[{ ano: 2020, mes: 11, posicao: 1, valor: 5500 }, { ano: 2020, mes: 11, posicao: 13, valor: 165 }]} />
      ) : (
        <FormularioProcesso processoId={null} />
      )}
    </main>
  );
}
