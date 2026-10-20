import Link from "next/link";
import { AbaDocumento } from "@/components/AbaDocumento";
import { AvisoSoCalculado } from "@/components/AvisoSoCalculado";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Exercícios por ano": Solicitação, Verso e Comprovação do recebido e do devido de um ano (as abas NN da planilha). */
export default async function Exercicios({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ano?: string }> }) {
  const { id } = await params;
  const { processo, bloqueado } = await carregarProcesso(id);
  const ini = Number(processo.periodo_inicio?.slice(0, 4) ?? 0), fim = Number(processo.periodo_fim?.slice(0, 4) ?? 0);
  const anos = ini && fim ? Array.from({ length: fim - ini + 1 }, (_, i) => ini + i) : [];
  const pedido = Number((await searchParams).ano);
  const ano = anos.includes(pedido) ? pedido : anos[0];
  if (!ano) return <p className="cartao text-sm text-suave">Informe o período da dívida em “Dados do favorecido”.</p>;
  return (
    <AbaDocumento processoId={id} doc="exercicio" ano={ano} bloqueado={bloqueado} observacao={
      <AvisoSoCalculado processoId={id} titulo="Ano do exercício"
        descricao={`Folha de Cálculo por Exercício, Verso e Comprovação dos valores recebidos e devidos de ${ano}.`}>
        <nav aria-label="Anos" className="flex flex-wrap gap-2">
          {anos.map((a) => (
            <Link key={a} href={`/processos/${id}/exercicios?ano=${a}`} aria-current={a === ano ? "page" : undefined}
              className={`border px-3 py-1 tabular-nums ${a === ano ? "border-marca-700 bg-marca-700 text-white" : "border-borda bg-white hover:bg-fundo"}`}>
              {a}
            </Link>
          ))}
        </nav>
      </AvisoSoCalculado>
    } />
  );
}
