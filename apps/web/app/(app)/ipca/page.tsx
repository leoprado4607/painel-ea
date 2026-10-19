import { Aviso } from "@/components/Aviso";
import { BuscarIndices } from "@/components/BuscarIndices";
import { descreverRegra } from "@/lib/indice";
import { sessao } from "@/lib/sessao";
import { MESES, MESES_CURTOS } from "@/lib/tipos";

const mesAno = (d: string) => `${MESES[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}`;
const quando = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";

/** Atualização do IPCA-E: situação das séries, últimos índices e botão para buscar agora. */
export default async function Ipca() {
  const { supabase } = await sessao();
  const [{ data: situacao }, { data: regras }, { data: recentes }] = await Promise.all([
    supabase.from("situacao_indices").select("serie, ultimo_mes, atrasado, ultima_coleta, situacao_ultima_coleta").order("serie"),
    supabase.from("regra_indice").select("vigencia_inicio, serie").order("vigencia_inicio"),
    supabase.from("indice_composto").select("ano, mes, percentual, serie").order("ano", { ascending: false }).order("mes", { ascending: false }).limit(12),
  ]);
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">Atualização do IPCA-E</h1>
        <p className="text-sm text-suave">
          Os processos são corrigidos pela série {descreverRegra(regras ?? [])}. A busca roda sozinha todo dia às 09:00 (Brasília),
          no IBGE e no Banco Central. Um processo já emitido continua com o índice da emissão.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {(situacao ?? []).map((s) => (
          <section key={s.serie} className="cartao space-y-1">
            <p className="text-sm text-suave">{s.serie} atualizado até</p>
            <p className="text-2xl font-bold text-marca-800">{mesAno(s.ultimo_mes)}</p>
            <p className="text-xs text-suave">
              Última busca: {quando(s.ultima_coleta)}
              {s.situacao_ultima_coleta === "erro" ? " · terminou com erro" : s.situacao_ultima_coleta === "sem_novidade" ? " · sem mês novo" : ""}
            </p>
            {s.atrasado && <Aviso tipo="atencao">Série com mais de dois meses sem índice novo. Confira se o IBGE já publicou.</Aviso>}
          </section>
        ))}
      </div>

      <BuscarIndices />

      <section className="cartao overflow-x-auto">
        <h2 className="mb-3 font-semibold">Últimos 12 meses usados na correção</h2>
        <table className="w-full min-w-[24rem] text-sm">
          <thead className="text-left text-suave"><tr><th className="py-2">Mês</th><th>Série</th><th className="text-right">Variação</th></tr></thead>
          <tbody className="tabular-nums">
            {(recentes ?? []).map((i) => (
              <tr key={`${i.ano}-${i.mes}`} className="border-t border-borda">
                <td className="py-2">{MESES_CURTOS[i.mes - 1]}/{i.ano}</td>
                <td className="text-suave">{i.serie}</td>
                <td className={`text-right ${Number(i.percentual) > 1.99 ? "font-semibold text-red-800" : ""}`}>
                  {Number(i.percentual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ajuda">Em vermelho: mês acima de 1,99% (“valor acima do normal”, como alertava a planilha).</p>
      </section>
    </div>
  );
}
