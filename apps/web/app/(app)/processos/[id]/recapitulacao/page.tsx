import { AbaDocumento } from "@/components/AbaDocumento";
import { AvisoSoCalculado } from "@/components/AvisoSoCalculado";
import { carregarProcesso } from "@/lib/processo";

/** Aba "Recapitulação": receitas, descontos e valor líquido corrigidos, ano a ano. */
export default async function Recapitulacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { bloqueado } = await carregarProcesso(id);
  return (
    <AbaDocumento processoId={id} doc="recapitulacao" bloqueado={bloqueado} observacao={
      <AvisoSoCalculado processoId={id} titulo="Recapitulação" descricao="Receitas, descontos e valor líquido corrigidos, ano a ano." />
    } />
  );
}
