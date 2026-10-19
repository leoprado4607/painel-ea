import { AbasProcesso } from "@/components/AbasProcesso";
import { Aviso } from "@/components/Aviso";
import { carregarProcesso } from "@/lib/processo";

export default async function LayoutProcesso({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, militar, bloqueado } = await carregarProcesso(id);
  return (
    <div className="space-y-5">
      <AbasProcesso id={id} situacao={processo.situacao}
        titulo={[militar.posto_graduacao, militar.nome].filter(Boolean).join(" ")}
        subtitulo={`Processo ${processo.numero || "s/nº"}${processo.especie_divida ? ` · ${processo.especie_divida}` : ""}`} />
      {bloqueado && <Aviso tipo="info">Este processo já foi emitido e está somente para consulta.</Aviso>}
      {children}
    </div>
  );
}
