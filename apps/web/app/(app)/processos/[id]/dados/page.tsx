import { DadosFavorecido } from "@/components/DadosFavorecido";
import { documentosRecentesDoOperador } from "@/lib/documentos-recentes";
import { carregarProcesso } from "@/lib/processo";
import { sessao } from "@/lib/sessao";

export default async function Dados({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ conferir?: string }> }) {
  const { id } = await params;
  const { conferir } = await searchParams;
  const { supabase, processo, militar, rubricas, bloqueado, fichasCarregadas } = await carregarProcesso(id);
  const { user } = await sessao();
  const documentosRecentes = bloqueado ? [] : await documentosRecentesDoOperador(supabase, user.id, id);
  return (
    <div className="space-y-5">
      <DadosFavorecido processoId={id} valores={{ ...processo, ...militar }} /* militar por cima: "situacao" aqui é a do militar, não a do processo (rascunho) */ bloqueado={bloqueado} conferirBanco={conferir === "banco"} fichasCarregadas={fichasCarregadas}
        rubricas={rubricas.map(({ posicao, codigo }) => ({ posicao, codigo }))} documentosRecentes={documentosRecentes} />
    </div>
  );
}
