import { AbaDocumento } from "@/components/AbaDocumento";
import { AvisoSoCalculado } from "@/components/AvisoSoCalculado";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Resumo": a receber, recebido e líquido (sem correção) por rubrica, de dois em dois anos. */
export default async function Resumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { bloqueado } = await carregarProcesso(id);
  return (
    <AbaDocumento processoId={id} doc="resumo" bloqueado={bloqueado} observacao={
      <AvisoSoCalculado processoId={id} titulo="Resumo" descricao="A receber, recebido e líquido (sem correção) por rubrica, de dois em dois anos." />
    } />
  );
}
