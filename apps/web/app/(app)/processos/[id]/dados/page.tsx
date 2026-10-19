import { FormularioProcesso } from "@/components/FormularioProcesso";
import { carregarProcesso } from "@/lib/processo";

export default async function Dados({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, militar, bloqueado } = await carregarProcesso(id);
  return <FormularioProcesso processoId={id} valores={{ ...militar, ...processo }} bloqueado={bloqueado} />;
}
