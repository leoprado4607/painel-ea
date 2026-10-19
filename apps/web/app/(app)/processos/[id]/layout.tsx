import { AbasProcesso } from "@/components/AbasProcesso";
import { Aviso } from "@/components/Aviso";
import { carregarProcesso } from "@/lib/processo";

/** Processo: barra lateral com as abas à esquerda (computador) e o conteúdo da aba à direita. */
export default async function LayoutProcesso({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, militar, bloqueado } = await carregarProcesso(id);
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
      <AbasProcesso id={id} situacao={processo.situacao}
        titulo={[militar.posto_graduacao, militar.nome].filter(Boolean).join(" ")}
        subtitulo={`Processo ${processo.numero || "s/nº"}${processo.especie_divida ? ` · ${processo.especie_divida}` : ""}`} />
      <div className="min-w-0 space-y-5">
        {bloqueado && <Aviso tipo="info">Este processo já foi emitido e está somente para consulta.</Aviso>}
        {children}
      </div>
    </div>
  );
}
