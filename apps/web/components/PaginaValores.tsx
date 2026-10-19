import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { EnvioFichas } from "@/components/EnvioFichas";
import { ValoresMensais } from "@/components/ValoresMensais";
import { previaDosGuardados } from "@/lib/acoes/fichas";
import { mesDeData } from "@/lib/lancamentos";
import { carregarProcesso } from "@/lib/processo";

export async function PaginaValores({ id, tipo, proximaEtapa, importado }: {
  id: string; tipo: "recebido" | "devido"; proximaEtapa: string; importado?: boolean;
}) {
  const { processo, rubricas, lancamentos, bloqueado } = await carregarProcesso(id);
  if (!processo.periodo_inicio || !processo.periodo_fim) {
    return <Aviso tipo="atencao">Informe o período da dívida na etapa <Link href={`/processos/${id}/dados`} className="underline">Dados</Link>.</Aviso>;
  }
  const rub = rubricas.map(({ posicao, codigo, tipo }) => ({ posicao, codigo, tipo }));
  const previa = tipo === "recebido" && importado ? await previaDosGuardados(id) : undefined;
  return (
    <div className="space-y-5">
      {importado && (
        <Aviso tipo="ok">
          Processo criado a partir das fichas: dados do militar, período e valores recebidos foram preenchidos. Confira abaixo e na etapa Dados.
        </Aviso>
      )}
      {tipo === "recebido" && <EnvioFichas processoId={id} rubricas={rub} previaInicial={previa} bloqueado={bloqueado} />}
      <ValoresMensais
        processoId={id} tipo={tipo} proximaEtapa={proximaEtapa} bloqueado={bloqueado} rubricas={rub}
        inicio={mesDeData(processo.periodo_inicio)} fim={mesDeData(processo.periodo_fim)}
        linhas={lancamentos.filter((l) => l.tipo === tipo).map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor }))}
      />
    </div>
  );
}
