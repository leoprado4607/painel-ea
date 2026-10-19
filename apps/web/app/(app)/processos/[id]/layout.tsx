import Link from "next/link";
import { LembrarProcesso } from "@/components/AbasRodape";
import { Aviso } from "@/components/Aviso";
import { carregarProcesso } from "@/lib/processo";

export default async function LayoutProcesso({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { processo, militar, bloqueado } = await carregarProcesso(id);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/processos" className="text-sm text-marca-700 hover:underline">← Processos</Link>
        <h1 className="mt-1 text-xl font-bold">{militar.posto_graduacao} {militar.nome}</h1>
        <p className="text-sm text-suave">Processo {processo.numero || "s/nº"}{processo.especie_divida ? ` · ${processo.especie_divida}` : ""}</p>
      </div>
      <LembrarProcesso id={id} nome={[militar.posto_graduacao, militar.nome].filter(Boolean).join(" ")} />
      {bloqueado && <Aviso tipo="info">Este processo já foi emitido e está somente para consulta.</Aviso>}
      {children}
    </div>
  );
}
