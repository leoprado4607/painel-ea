import { FormularioRubricas } from "@/components/FormularioRubricas";
import { carregarProcesso } from "@/lib/processo";

export default async function Rubricas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rubricas, bloqueado } = await carregarProcesso(id);
  return <FormularioRubricas processoId={id} rubricas={rubricas.map(({ posicao, codigo, tipo }) => ({ posicao, codigo, tipo }))} bloqueado={bloqueado} />;
}
