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
        <h1 className="titulo-pagina">Processos</h1>
        <Link href="/processos/novo" className="botao">Novo processo</Link>
      </div>
      {processos.length === 0 ? (
        <div className="cartao space-y-4 py-10 text-center">
          <p className="rotulo-secao mx-auto max-w-md">Nenhum processo</p>
          <h2 className="text-2xl font-semibold text-carvao">Comece pelo contracheque ou pelas fichas</h2>
          <p className="mx-auto max-w-lg text-sm text-suave">
            Envie os PDFs e o site cria o processo com os dados do favorecido, o período e os valores recebidos. Também é possível digitar tudo.
          </p>
          <Link href="/processos/novo" className="botao">Criar o primeiro processo</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {processos.map((p) => {
            const nome = [p.militar?.posto_graduacao, p.militar?.nome].filter(Boolean).join(" ");
            return (
              <li key={p.id} className="cartao flex flex-wrap items-center gap-3 p-0 hover:border-marca-600">
                <Link href={`/processos/${p.id}/dados`}
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-5 outline-none focus-visible:ring-2 focus-visible:ring-marca-600">
                  <div className="min-w-0">
                    <p className="font-semibold">{nome}</p>
                    <p className="text-sm text-suave">
                      Processo {p.numero || "s/nº"} · Dívida de {mesAno(p.periodo_inicio)} a {mesAno(p.periodo_fim)}
                      {p.especie_divida ? ` · ${p.especie_divida}` : ""}
                      {p.om ? ` · ${p.om.nome}` : ""}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.05em] ${p.situacao === "rascunho" ? "bg-amber-100 text-amber-900" : "bg-marca-100 text-marca-800"}`}>
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
