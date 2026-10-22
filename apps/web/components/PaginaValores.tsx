import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { ValoresMensais } from "@/components/ValoresMensais";
import { mesDeData } from "@/lib/lancamentos";
import { recebidosPosPeriodo } from "@/lib/pos-periodo";
import { carregarProcesso } from "@/lib/processo";

export async function PaginaValores({ id, tipo, proximaEtapa, importado }: {
  id: string; tipo: "recebido" | "devido"; proximaEtapa: string; importado?: boolean;
}) {
  const { processo, rubricas, lancamentos, bloqueado } = await carregarProcesso(id);
  if (!processo.periodo_inicio || !processo.periodo_fim) {
    return <Aviso tipo="atencao">Informe o período da dívida na etapa <Link href={`/processos/${id}/dados`} className="underline">Dados</Link>.</Aviso>;
  }
  const rub = rubricas.map(({ posicao, codigo, tipo }) => ({ posicao, codigo, tipo }));
  return (
    <div className="space-y-5">
      {importado && (
        <Aviso tipo="ok">Valores recebidos preenchidos pelos documentos enviados. Confira mês a mês abaixo.</Aviso>
      )}
      {/* o envio de contracheque e fichas fica só em "Informações" (pedido do usuário) */}
      <ValoresMensais
        processoId={id} tipo={tipo} proximaEtapa={proximaEtapa} bloqueado={bloqueado} rubricas={rub}
        inicio={mesDeData(processo.periodo_inicio)} fim={mesDeData(processo.periodo_fim)}
        linhas={lancamentos.filter((l) => l.tipo === tipo).map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor }))}
        posPeriodo={tipo === "recebido" ? recebidosPosPeriodo(processo.complementos) : []}
      />
    </div>
  );
}
