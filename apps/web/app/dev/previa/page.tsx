import { notFound } from "next/navigation";
import { AbaDocumento } from "@/components/AbaDocumento";
import { AbasProcesso } from "@/components/AbasProcesso";
import { BarraLateral, ProvedorProcesso, RegistrarProcesso } from "@/components/BarraLateral";
import { FormularioProcesso } from "@/components/FormularioProcesso";
import { FormularioRubricas } from "@/components/FormularioRubricas";
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
    <main className="mx-auto max-w-7xl px-4 py-6">
      {tela === "abas" ? (
        <ProvedorProcesso>
        <div className="-mx-4 -my-6 min-h-screen lg:flex">
          <BarraLateral admin usuario="Maj FULANO DE TAL" />
          <RegistrarProcesso id="00000000-0000-0000-0000-000000000000" situacao="rascunho"
            titulo="1º Sgt FULANO DE TAL DA SILVA" subtitulo="Processo 012/2026 · Diferença de adicional de habilitação" />
          <div className="min-w-0 flex-1 space-y-4 px-4 pb-10 pt-5 lg:px-8 lg:pt-8">
          <AbasProcesso id="00000000-0000-0000-0000-000000000000" situacao="rascunho"
            titulo="1º Sgt FULANO DE TAL DA SILVA" subtitulo="Processo 012/2026 · Diferença de adicional de habilitação" />
          <AbaDocumento processoId="00000000-0000-0000-0000-000000000000" doc="cpex" bloqueado={false} grupos={[
            { titulo: "Pensão judicial (ZED)", campos: [
              { nome: "possui_pensao_judicial", rotulo: "Possui pensão judicial no período da dívida", tipo: "checkbox", valor: true },
              { nome: "c.pensao.nome", rotulo: "Nome do beneficiário", valor: "Maria de Teste", largo: true },
              { nome: "c.pensao.cpf", rotulo: "CPF", placeholder: "000.000.000-00" },
            ] },
          ]} />
          </div>
        </div>
        </ProvedorProcesso>
      ) : tela === "valores" ? (
        <ValoresMensais processoId="previa" tipo="devido" proximaEtapa="conferencia" bloqueado={false} rubricas={rubricas}
          inicio={{ ano: 2020, mes: 11 }} fim={{ ano: 2021, mes: 6 }}
          linhas={[{ ano: 2020, mes: 11, posicao: 1, valor: 5500 }, { ano: 2020, mes: 11, posicao: 13, valor: 165 }]} />
      ) : tela === "rubricas" ? (
        <FormularioRubricas processoId="previa" bloqueado={false} rubricas={Array.from({ length: 17 }, (_, i) => ({
          posicao: i + 1, codigo: i >= 12 ? rubricas.find((r) => r.posicao === i + 1)?.codigo ?? "" : "", tipo: i < 12 ? "Receita" as const : "Despesa" as const,
        }))} />
      ) : (
        <FormularioProcesso processoId={null} />
      )}
    </main>
  );
}
