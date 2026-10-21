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
  situacao: "rascunho" | "emitido" | "arquivado";
  /** pode excluir (criador ou Admin); senão, "Só consulta" */
  meu: boolean;
  /** "640093.005344/2026-43 de 1º Sgt …" (confirmação da exclusão) */
  descricao: string;
  /** só para o Admin: operador responsável (quem criou), "Cb Bruno Guilherme de Souza Bezerra" */
  operador?: string | null;
  /** texto em que a pesquisa procura: nome, posto (abreviado e por extenso), OM e espécie da dívida */
  busca: string;
}

const SITUACAO = { rascunho: "Rascunho", emitido: "Emitido", arquivado: "Arquivado" } as const;

/** Lista de processos com a caixa de pesquisa ao lado de "Novo processo" (filtra enquanto digita, no navegador). */
export function ListaProcessos({ cards }: { cards: CardProcesso[] }) {
  const [texto, setTexto] = useState("");
  // todas as palavras digitadas precisam aparecer (em qualquer ordem): "sgt fard" acha 1º Sgt com auxílio fardamento
  const palavras = normalizarBusca(texto).split(" ").filter(Boolean);
  const visiveis = palavras.length ? cards.filter((c) => palavras.every((p) => c.busca.includes(p))) : cards;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-pagina">Processos</h1>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <label htmlFor="pesquisa-processos" className="sr-only">Pesquisar processos</label>
          <input id="pesquisa-processos" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Pesquisar por nome, posto, OM ou tipo da dívida" className="entrada w-full sm:w-80" autoComplete="off" />
          <Link href="/processos/novo" className="botao">Novo processo</Link>
        </div>
      </div>
      {palavras.length > 0 && (
        <p className="text-sm text-suave" aria-live="polite">
          {visiveis.length === 1 ? "1 processo encontrado" : `${visiveis.length} processos encontrados`}
        </p>
      )}
      {visiveis.length === 0 ? (
        <p className="cartao text-sm text-suave">Nenhum processo encontrado para “{texto.trim()}”.</p>
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
                  {p.operador && <p className="text-sm text-suave">Operador: {p.operador}</p>}
                </div>
                <span className="flex flex-wrap items-center gap-2">
                  {!p.meu && <span className="border border-borda px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.05em] text-suave">Só consulta</span>}
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
