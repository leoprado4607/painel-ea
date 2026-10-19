import Link from "next/link";
import { ExcluirProcesso } from "@/components/ExcluirProcesso";
import { sessao } from "@/lib/sessao";
import type { Militar, Processo } from "@/lib/tipos";

const SITUACAO = { rascunho: "Rascunho", emitido: "Emitido", arquivado: "Arquivado" } as const;
const mesAno = (d: string | null) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

export default async function Processos() {
  const { supabase, perfil } = await sessao();
  const admin = perfil?.papel === "admin";
  const { data } = await supabase.from("processo")
    .select("*, militar(nome, posto_graduacao), om(nome)").order("atualizado_em", { ascending: false })
    .returns<(Processo & { militar: Pick<Militar, "nome" | "posto_graduacao">; om: { nome: string } | null })[]>();
  const processos = data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Processos</h1>
        <Link href="/processos/novo" className="botao">Novo processo</Link>
      </div>
      {processos.length === 0 ? (
        <div className="cartao text-center text-sm text-suave">Nenhum processo ainda. Comece por “Novo processo”.</div>
      ) : (
        <ul className="space-y-2">
          {processos.map((p) => {
            const nome = [p.militar?.posto_graduacao, p.militar?.nome].filter(Boolean).join(" ");
            return (
              <li key={p.id} className="cartao flex flex-wrap items-center gap-3 p-0 hover:border-marca-600">
                <Link href={`/processos/${p.id}/dados`}
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-lg p-5 outline-none focus-visible:ring-2 focus-visible:ring-marca-600">
                  <div className="min-w-0">
                    <p className="font-semibold">{nome}</p>
                    <p className="text-sm text-suave">
                      Processo {p.numero || "s/nº"} · Dívida de {mesAno(p.periodo_inicio)} a {mesAno(p.periodo_fim)}
                      {p.especie_divida ? ` · ${p.especie_divida}` : ""}
                      {p.om ? ` · ${p.om.nome}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.situacao === "rascunho" ? "bg-amber-100 text-amber-900" : "bg-marca-100 text-marca-800"}`}>
                    {SITUACAO[p.situacao]}
                  </span>
                </Link>
                {admin && (
                  <div className="pb-4 pr-5 sm:pb-0">
                    <ExcluirProcesso id={p.id} emitido={p.situacao !== "rascunho"}
                      descricao={`${p.numero || "s/nº"} de ${nome}`} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
