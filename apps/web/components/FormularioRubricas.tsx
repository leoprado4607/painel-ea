"use client";
import type { TipoRubrica } from "@painel-ea/engine";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { salvarRubricas } from "@/lib/acoes/valores";
import { RUBRICAS_RECEITA_ATIVA } from "@/lib/rubricas-siappes";

interface R { posicao: number; codigo: string; tipo: TipoRubrica }

/** Posições 1 a 12: receitas, escolhidas na lista da Tab_pag do SIAPPES (13 a 17: despesas). */
const ULTIMA_RECEITA = 12;

export function FormularioRubricas({ processoId, rubricas, bloqueado }: { processoId: string; rubricas: R[]; bloqueado: boolean }) {
  const [lista, setLista] = useState<R[]>(rubricas);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const router = useRouter();
  const mudar = (posicao: number, campo: "codigo" | "tipo", valor: string) =>
    setLista((l) => l.map((r) => (r.posicao === posicao ? { ...r, [campo]: valor } : r)));

  const salvar = (seguir: boolean) => iniciar(async () => {
    const r = await salvarRubricas(processoId, lista);
    if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    if (seguir) router.push(`/processos/${processoId}/recebidos`);
    else setMsg({ tipo: "ok", texto: "Rubricas salvas." });
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">
        São até 17 rubricas, como na planilha. Nas posições 1 a 12 (receitas), escolha a rubrica do pessoal da ativa na lista da Tabela de Pagamento
        do SIAPPES (digite o código ou parte do nome para filtrar). Deixe em branco as posições que não usar. O tipo define se o valor
        soma (Receita), subtrai (Despesa) ou só aparece no detalhamento (“-”).
      </p>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="cartao divide-y divide-borda p-0">
        {lista.map((r) => (
          <div key={r.posicao} className="grid grid-cols-[2.5rem_1fr_9rem] items-center gap-3 px-4 py-2">
            <span className="text-sm font-semibold text-suave">{r.posicao}</span>
            <label className="sr-only" htmlFor={`cod-${r.posicao}`}>Código da posição {r.posicao}</label>
            <input id={`cod-${r.posicao}`} className="entrada" value={r.codigo} disabled={bloqueado}
              list={r.posicao <= ULTIMA_RECEITA ? "rubricas-receita-siappes" : undefined}
              placeholder={r.posicao <= ULTIMA_RECEITA ? "Escolha na lista (ex.: A01 - SOLDO)" : "(sem rubrica)"}
              onChange={(e) => mudar(r.posicao, "codigo", e.target.value)} />
            <label className="sr-only" htmlFor={`tipo-${r.posicao}`}>Tipo da posição {r.posicao}</label>
            <select id={`tipo-${r.posicao}`} className="entrada" value={r.tipo} disabled={bloqueado}
              onChange={(e) => mudar(r.posicao, "tipo", e.target.value)}>
              <option>Receita</option><option>Despesa</option><option value="-">- (neutra)</option>
            </select>
          </div>
        ))}
      </div>
      <datalist id="rubricas-receita-siappes">
        {RUBRICAS_RECEITA_ATIVA.map((c) => <option key={c} value={c} />)}
      </datalist>
      {!bloqueado && (
        <div className="flex justify-end gap-2">
          <button className="botao-sec" disabled={salvando} onClick={() => salvar(false)}>Salvar</button>
          <button className="botao" disabled={salvando} onClick={() => salvar(true)}>Salvar e continuar</button>
        </div>
      )}
    </div>
  );
}
