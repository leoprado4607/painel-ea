"use client";
import Link from "next/link";
import type { TipoRubrica } from "@painel-ea/engine";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { RecebidosPosPeriodo, itemDaLinha, type LinhaPosPeriodo } from "@/components/RecebidosPosPeriodo";
import { salvarLancamentos, salvarRecebidosPosPeriodo } from "@/lib/acoes/valores";
import { formatarReais, lerReais } from "@/lib/dinheiro";
import {
  anosDoPeriodo, copiarMes, definirValor, diferencas, gradeDeLinhas, linhasDaGrade, mesesDoPeriodo, repetirAte, totalDoMes,
  valoresDoMes, type Linha, type MesAno,
} from "@/lib/lancamentos";
import type { RecebidoPosPeriodo } from "@/lib/pos-periodo";
import { MESES, MESES_CURTOS } from "@/lib/tipos";

interface Props {
  processoId: string;
  tipo: "recebido" | "devido";
  rubricas: { posicao: number; codigo: string; tipo: TipoRubrica }[];
  inicio: MesAno;
  fim: MesAno;
  linhas: Linha[];
  bloqueado: boolean;
  proximaEtapa: string;
  /** só nos recebidos: valores recebidos após o período da dívida */
  posPeriodo?: RecebidoPosPeriodo[];
}

const igual = (a: MesAno, b: MesAno) => a.ano === b.ano && a.mes === b.mes;

export function ValoresMensais({ processoId, tipo, rubricas, inicio, fim, linhas, bloqueado, proximaEtapa, posPeriodo = [] }: Props) {
  const router = useRouter();
  const [grade, setGrade] = useState(() => gradeDeLinhas(linhas));
  const [atual, setAtual] = useState<MesAno>(inicio);
  const [repetirPara, setRepetirPara] = useState<string>("");
  const [textos, setTextos] = useState<Record<number, string>>({});
  const [erros, setErros] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  // recebidos após o período: edição em texto; comparados com o gravado para saber se há alteração
  const paraLinhas = (lista: RecebidoPosPeriodo[]): LinhaPosPeriodo[] =>
    lista.map((r, i) => ({ id: i + 1, ano: String(r.ano), mes: r.mes, posicao: r.posicao, valor: formatarReais(r.valor) }));
  const [linhasPos, setLinhasPos] = useState(() => paraLinhas(posPeriodo));
  const [errosPos, setErrosPos] = useState<Record<number, string>>({});
  const assinaturaPos = (l: LinhaPosPeriodo[]) => JSON.stringify(l.map(({ ano, mes, posicao, valor }) => [ano, mes, posicao, lerReais(valor)]));
  const posAlterado = tipo === "recebido" && assinaturaPos(linhasPos) !== assinaturaPos(paraLinhas(posPeriodo));

  const meses = useMemo(() => mesesDoPeriodo(inicio, fim), [inicio, fim]);
  const ativas = rubricas.filter((r) => r.codigo);
  const pendentes = diferencas(linhas, linhasDaGrade(grade));
  const alterado = pendentes.gravar.length + pendentes.apagar.length > 0 || posAlterado;
  const idx = meses.findIndex((m) => igual(m, atual));
  const valores = valoresDoMes(grade, atual);

  // textos dos campos acompanham o mês selecionado
  useEffect(() => {
    const v = valoresDoMes(grade, atual);
    // campo sem valor fica vazio, com "0,00" só como fundo (placeholder)
    setTextos(Object.fromEntries(ativas.map((r) => [r.posicao, formatarReais(v[r.posicao])])));
    setErros({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, grade]);

  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (alterado) e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  function confirmarCampo(posicao: number) {
    const v = lerReais(textos[posicao] ?? "");
    if (Number.isNaN(v)) return setErros((e) => ({ ...e, [posicao]: "Valor inválido. Use o formato 1.234,56." }));
    setErros((e) => { const { [posicao]: _, ...resto } = e; return resto; });
    setGrade((g) => definirValor(g, atual, posicao, v));
  }

  const salvar = (seguir: boolean) => iniciar(async () => {
    let itensPos: RecebidoPosPeriodo[] | null = null;
    if (posAlterado) {
      const lidos = linhasPos.map((l) => ({ id: l.id, ...itemDaLinha(l, fim) }));
      const erradas = Object.fromEntries(lidos.filter((x) => x.erro).map((x) => [x.id, x.erro!]));
      setErrosPos(erradas);
      if (Object.keys(erradas).length) return setMsg({ tipo: "erro", texto: "Confira os recebidos após o período da dívida." });
      itensPos = lidos.map((x) => x.item!);
    }
    const r = await salvarLancamentos(processoId, tipo, pendentes.gravar, pendentes.apagar);
    if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
    if (itensPos) {
      const r2 = await salvarRecebidosPosPeriodo(processoId, itensPos);
      if (r2.erro) return setMsg({ tipo: "erro", texto: r2.erro });
    }
    setMsg({ tipo: "ok", texto: "Valores salvos." });
    router.refresh();
    if (seguir) router.push(`/processos/${processoId}/${proximaEtapa}`);
  });

  const temValor = (m: MesAno) => Object.keys(valoresDoMes(grade, m)).length > 0;

  return (
    <div className="space-y-4">
      {tipo === "recebido" && (
        <Aviso tipo="info">
          Valores recebidos, exatamente como constam na ficha financeira. Para preenchê-los pelos PDFs, envie as fichas
          financeiras (SIPPES ou SIAPPES) em <Link href={`/processos/${processoId}/dados`} className="font-medium underline">Informações</Link>;
          confira e corrija aqui se precisar.
        </Aviso>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}

      <div className="cartao space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ano">
          {anosDoPeriodo(inicio, fim).map((ano) => (
            <button key={ano} role="tab" aria-selected={ano === atual.ano}
              onClick={() => setAtual(meses.find((m) => m.ano === ano)!)}
              className={`px-3 py-1 text-sm font-semibold ${ano === atual.ano ? "bg-marca-700 text-white" : "bg-fundo text-tinta hover:bg-marca-50"}`}>
              {ano}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Mês">
          {meses.filter((m) => m.ano === atual.ano).map((m) => (
            <button key={m.mes} role="tab" aria-selected={igual(m, atual)} onClick={() => setAtual(m)}
              className={`relative border px-2.5 py-1 text-sm ${igual(m, atual) ? "border-marca-700 bg-marca-50 font-semibold" : "border-borda bg-white"}`}>
              {MESES_CURTOS[m.mes - 1]}
              {temValor(m) && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-marca-600" aria-label="com valores" />}
            </button>
          ))}
        </div>
        {tipo === "recebido" && (
          <RecebidosPosPeriodo linhas={linhasPos} setLinhas={setLinhasPos} fim={fim} bloqueado={bloqueado} erros={errosPos}
            receitas={ativas.filter((r) => r.tipo === "Receita").map(({ posicao, codigo }) => ({ posicao, codigo }))} />
        )}
      </div>

      <section className="cartao">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{MESES[atual.mes - 1]}/{atual.ano}</h2>
          {!bloqueado && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="botao-sec py-1.5" disabled={idx <= 0} onClick={() => setGrade((g) => copiarMes(g, meses[idx - 1]!, atual))}>
                Copiar do mês anterior
              </button>
              <label className="sr-only" htmlFor="repetir">Repetir até</label>
              <select id="repetir" className="entrada w-auto py-1.5" value={repetirPara} onChange={(e) => setRepetirPara(e.target.value)}>
                <option value="">Repetir até…</option>
                {meses.slice(idx + 1).map((m) => (
                  <option key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>{MESES_CURTOS[m.mes - 1]}/{m.ano}</option>
                ))}
              </select>
              <button className="botao-sec py-1.5" disabled={!repetirPara} onClick={() => {
                const [a, m] = repetirPara.split("-").map(Number);
                setGrade((g) => repetirAte(g, atual, { ano: a!, mes: m! }));
                setRepetirPara("");
              }}>Repetir</button>
            </div>
          )}
        </div>

        {ativas.length === 0 ? (
          <p className="text-sm text-suave">Nenhuma rubrica com código. Defina as rubricas na etapa anterior.</p>
        ) : (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {ativas.map((r) => (
              <div key={r.posicao}>
                <label htmlFor={`v-${r.posicao}`} className="rotulo flex items-center justify-between gap-2">
                  <span>{r.codigo}</span>
                  <span className={`text-xs font-normal ${r.tipo === "Despesa" ? "text-red-700" : r.tipo === "Receita" ? "text-marca-700" : "text-suave"}`}>
                    {r.tipo === "-" ? "neutra" : r.tipo}
                  </span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-2 text-sm text-suave">R$</span>
                  <input id={`v-${r.posicao}`} inputMode="decimal" disabled={bloqueado} value={textos[r.posicao] ?? ""}
                    onChange={(e) => setTextos((t) => ({ ...t, [r.posicao]: e.target.value }))}
                    onBlur={() => confirmarCampo(r.posicao)}
                    aria-invalid={!!erros[r.posicao]}
                    className={`entrada pl-9 text-right tabular-nums ${erros[r.posicao] ? "entrada-erro" : ""}`} placeholder="0,00" />
                </div>
                {erros[r.posicao] && <p className="erro">{erros[r.posicao]}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-borda pt-3 text-sm">
          <span className="text-suave">Total do mês (receitas − despesas)</span>
          <span className="font-semibold tabular-nums">R$ {formatarReais(totalDoMes(valores, rubricas))}</span>
        </div>
        <div className="mt-3 flex justify-between">
          <button className="botao-sec py-1.5" disabled={idx <= 0} onClick={() => setAtual(meses[idx - 1]!)}>← Mês anterior</button>
          <button className="botao-sec py-1.5" disabled={idx >= meses.length - 1} onClick={() => setAtual(meses[idx + 1]!)}>Próximo mês →</button>
        </div>
      </section>

      {!bloqueado && (
        <div className="sticky bottom-2 z-20 border border-borda bg-white/95 shadow-[0_8px_24px_-12px_rgba(29,36,32,.45)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-suave">{alterado ? `${pendentes.gravar.length + pendentes.apagar.length + (posAlterado ? 1 : 0)} alteração(ões) não salvas` : "Tudo salvo"}</span>
            <div className="flex gap-2">
              <button className="botao-sec" disabled={!alterado || salvando} onClick={() => salvar(false)}>Salvar</button>
              <button className="botao" disabled={salvando} onClick={() => salvar(true)}>{salvando ? "Salvando…" : "Salvar e continuar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
