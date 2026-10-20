import { AbasProcesso } from "@/components/AbasProcesso";
import { Aviso } from "@/components/Aviso";
import { RegistrarProcesso } from "@/components/BarraLateral";
import { carregarProcesso } from "@/lib/processo";

/**
 * Processo: as abas aparecem na barra lateral do sistema (computador), registradas aqui; no celular, numa tira
 * de abas acima do conteúdo.
 */
export default async function LayoutProcesso({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, militar, bloqueado } = await carregarProcesso(id);
  const titulo = [militar.posto_graduacao, militar.nome].filter(Boolean).join(" ");
  const subtitulo = `Processo ${processo.numero || "s/nº"}${processo.especie_divida ? ` · ${processo.especie_divida}` : ""}`;
  return (
    <div className="space-y-4 lg:space-y-5">
      <RegistrarProcesso id={id} titulo={titulo} subtitulo={subtitulo} situacao={processo.situacao} />
      <AbasProcesso id={id} titulo={titulo} subtitulo={subtitulo} situacao={processo.situacao} />
      {/* no computador, o nome do processo fica na barra lateral; aqui só o aviso de processo emitido */}
      {bloqueado && <Aviso tipo="info">Este processo já foi emitido e está somente para consulta.</Aviso>}
      {children}
    </div>
  );
}
