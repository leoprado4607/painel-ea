"use client";
import Link from "next/link";
import { useState } from "react";
import { EditarProcesso } from "@/components/EditarProcesso";
import { ExcluirProcesso } from "@/components/ExcluirProcesso";
import { normalizarBusca } from "@/lib/busca";

export interface CardProcesso {
  id: string;
  /** "1º Sgt SANDRO LUIS DE LIMA GONCALVES" */
  nome: string;
  /** linha de baixo: OM · dívida · espécie · valor */
  om: string | null; periodo: string; especie: string | null; valor: string;
  /** valor final corrigido, para ordenar (null se ainda não calculado) */
  valorNumero: number | null;
  situacao: "rascunho" | "emitido" | "arquivado";
  /** pode excluir e reabrir (criador ou Admin) */
  meu: boolean;
  /** pode alterar e emitir (rascunho: qualquer operador); senão, "Só consulta" */
  editavel?: boolean;
  /** "640093.005344/2026-43 de 1º Sgt …" (confirmação da exclusão) */
  descricao: string;
  /** operador que iniciou o processo (Admin: todos os cards; operador: só os rascunhos), "Cb Bruno Guilherme de Souza Bezerra" */
  operador?: string | null;
  /** quem gerou o PDF da última versão emitida (pode não ser quem criou o processo) */
  emitidoPor?: string | null;
  /** texto em que a pesquisa procura: nome, posto (abreviado e por extenso), OM e espécie da dívida */
  busca: string;
}

const SITUACAO = { rascunho: "Rascunho", emitido: "Emitido", arquivado: "Arquivado" } as const;
type Situacao = CardProcesso["situacao"];
// ordem dos cards: rascunhos, depois emitidos (e arquivados); em cada situação, do maior valor para o menor
const ORDEM: Record<Situacao, number> = { rascunho: 0, emitido: 1, arquivado: 2 };
const ordenar = (a: CardProcesso, b: CardProcesso) =>
  ORDEM[a.situacao] - ORDEM[b.situacao] || (b.valorNumero ?? -Infinity) - (a.valorNumero ?? -Infinity);

/** Lista de processos com os filtros de situação e a caixa de pesquisa ao lado de "Novo cálculo" (filtra no navegador). */
export function ListaProcessos({ cards }: { cards: CardProcesso[] }) {
  const [texto, setTexto] = useState("");
  // filtro por situação: clicar de novo no botão ativo tira o filtro
  const [filtro, setFiltro] = useState<Situacao | null>(null);
  // filtro por espécie da dívida: só as espécies que já aparecem nos processos cadastrados
  const [especie, setEspecie] = useState("");
  const especies = [...new Set(cards.map((c) => c.especie).filter((e): e is string => !!e))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  // todas as palavras digitadas precisam aparecer (em qualquer ordem): "sgt fard" acha 1º Sgt com auxílio fardamento
  const palavras = normalizarBusca(texto).split(" ").filter(Boolean);
  const visiveis = cards
    .filter((c) => (!filtro || c.situacao === filtro) && (!especie || c.especie === especie) && palavras.every((p) => c.busca.includes(p)))
    .sort(ordenar);
  const filtrando = palavras.length > 0 || filtro !== null || !!especie;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-pagina">Meus cálculos</h1>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <div role="group" aria-label="Filtrar por situação" className="flex gap-2">
            {(["emitido", "rascunho"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={filtro === s} onClick={() => setFiltro(filtro === s ? null : s)}
                className={`border px-3 py-2 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600
                  ${filtro === s ? "border-marca-700 bg-marca-700 text-white" : "border-borda bg-white text-tinta hover:border-marca-600"}`}>
                {SITUACAO[s]}
              </button>
            ))}
          </div>
          <label htmlFor="filtro-especie" className="sr-only">Filtrar por espécie da dívida</label>
          <select id="filtro-especie" value={especie} onChange={(e) => setEspecie(e.target.value)} className="entrada w-full sm:w-60">
            <option value="">Todas as espécies</option>
            {especies.map((e) => <option key={e}>{e}</option>)}
          </select>
          <label htmlFor="pesquisa-processos" className="sr-only">Pesquisar processos</label>
          <input id="pesquisa-processos" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Pesquisar por nome, posto, OM ou tipo da dívida" className="entrada w-full sm:w-80" autoComplete="off" />
          <Link href="/processos/novo" className="botao">Novo cálculo</Link>
        </div>
      </div>
      {filtrando && (
        <p className="text-sm text-suave" aria-live="polite">
          {visiveis.length === 1 ? "1 processo encontrado" : `${visiveis.length} processos encontrados`}
        </p>
      )}
      {visiveis.length === 0 ? (
        <p className="cartao text-sm text-suave">
          Nenhum processo{filtro ? ` ${SITUACAO[filtro].toLowerCase()}` : ""} encontrado{especie ? ` de ${especie}` : ""}{palavras.length ? ` para “${texto.trim()}”` : ""}.
        </p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((p) => (
            <li key={p.id} className="cartao flex flex-wrap items-center gap-3 p-0 hover:border-marca-600">
              <Link href={`/processos/${p.id}/dados`}
                className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-5 outline-none focus-visible:ring-2 focus-visible:ring-marca-600">
                <div className="min-w-0">
                  <p className="font-semibold">{p.nome}</p>
                  <p className="text-sm text-suave">
                    {p.om ? `${p.om} · ` : ""}Dívida de {p.periodo}{p.especie ? ` · ${p.especie}` : ""}
                    {" · "}<span className="font-medium text-carvao">{p.valor}</span>
                  </p>
                  {(p.operador || p.emitidoPor) && (
                    <p className="text-sm text-suave">
                      {[p.operador && `Operador: ${p.operador}`, p.emitidoPor && `Emitido por: ${p.emitidoPor}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {!(p.editavel ?? p.meu) && <span className="border border-borda px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.05em] text-suave">Só consulta</span>}
                  <span className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.05em] ${p.situacao === "rascunho" ? "bg-amber-100 text-amber-900" : "bg-marca-100 text-marca-800"}`}>
                    {SITUACAO[p.situacao]}
                  </span>
                </span>
              </Link>
              {p.meu && (
                <div className="flex flex-col items-end gap-2 pb-4 pr-5 sm:pb-0">
                  <ExcluirProcesso id={p.id} emitido={p.situacao !== "rascunho"} descricao={p.descricao} />
                  {/* só depois de emitido: reabre como rascunho, mantendo tudo o que foi lançado */}
                  {p.situacao === "emitido" && <EditarProcesso id={p.id} descricao={p.descricao} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
