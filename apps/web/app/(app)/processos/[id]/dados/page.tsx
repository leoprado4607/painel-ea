import { Aviso } from "@/components/Aviso";
import { DadosFavorecido } from "@/components/DadosFavorecido";
import { carregarProcesso } from "@/lib/processo";

export default async function Dados({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ importado?: string }> }) {
  const [{ id }, { importado }] = await Promise.all([params, searchParams]);
  const { processo, militar, rubricas, bloqueado } = await carregarProcesso(id);
  return (
    <div className="space-y-5">
      {importado === "1" && (
        <Aviso tipo="ok">
          Processo criado pelos documentos: dados do favorecido, período e valores recebidos foram preenchidos e os PDFs foram descartados.
          Confira abaixo e na aba Contracheque - F Financeira.
        </Aviso>
      )}
      <DadosFavorecido processoId={id} valores={{ ...militar, ...processo }} bloqueado={bloqueado}
        rubricas={rubricas.map(({ posicao, codigo }) => ({ posicao, codigo }))} />
    </div>
  );
}
