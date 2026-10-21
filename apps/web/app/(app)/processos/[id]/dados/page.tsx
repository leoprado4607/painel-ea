import { DadosFavorecido } from "@/components/DadosFavorecido";
import { carregarProcesso } from "@/lib/processo";

export default async function Dados({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ conferir?: string }> }) {
  const { id } = await params;
  const { conferir } = await searchParams;
  const { processo, militar, rubricas, bloqueado } = await carregarProcesso(id);
  return (
    <div className="space-y-5">
      <DadosFavorecido processoId={id} valores={{ ...processo, ...militar }} /* militar por cima: "situacao" aqui é a do militar, não a do processo (rascunho) */ bloqueado={bloqueado} conferirBanco={conferir === "banco"}
        rubricas={rubricas.map(({ posicao, codigo }) => ({ posicao, codigo }))} />
    </div>
  );
}
