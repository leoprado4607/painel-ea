"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Aviso } from "@/components/Aviso";
import { gravarFichaDigitadaAdicHab, informarDireitoAdicHab } from "@/lib/acoes/analise-adic-hab";
import { TABELA_AH, TIPOS_CURSO } from "@/lib/adic-hab";
import { CAMPOS_FICHA, numeroBr, ROTULO_CAMPO, type CampoFicha, type ValoresFicha } from "@/lib/ficha-digitada";
import { formatarReais } from "@/lib/dinheiro";
import { MESES_CURTOS } from "@/lib/tipos";

export interface DireitoAnalise {
  inicio: string; fim: string; dataRequerimento: string; tipo: string; curso: string; documento: string; percentualPedido: string;
}

const texto = (v: number) => (v ? formatarReais(v) : "");

/** Dados do direito: o que o processo (escaneado ou ilegível) não trouxe. */
function DadosDireito({ processoId, inicial }: { processoId: string; inicial: DireitoAnalise }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const v = Object.fromEntries(Object.keys(inicial).map((c) => [c, String(f.get(c) ?? "")])) as unknown as DireitoAnalise;
      setMsg(null);
      iniciar(async () => {
        const r = await informarDireitoAdicHab(processoId, v);
        if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
        setMsg({ tipo: "ok", texto: "Dados do direito gravados. A análise foi refeita." });
        router.refresh();
      });
    }}>
      <h3 className="rotulo-secao">Dados do direito</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="md-inicio" className="rotulo">Início do direito</label>
          <input id="md-inicio" name="inicio" type="date" defaultValue={inicial.inicio} className="entrada" />
          <p className="ajuda">Conclusão do curso ou termo inicial do reconhecimento.</p></div>
        <div><label htmlFor="md-fim" className="rotulo">Fim do período pedido</label>
          <input id="md-fim" name="fim" type="date" defaultValue={inicial.fim} className="entrada" /></div>
        <div><label htmlFor="md-req" className="rotulo">Data do requerimento</label>
          <input id="md-req" name="dataRequerimento" type="date" defaultValue={inicial.dataRequerimento} className="entrada" /></div>
        <div><label htmlFor="md-tipo" className="rotulo">Tipo do curso</label>
          <select id="md-tipo" name="tipo" defaultValue={inicial.tipo} className="entrada">
            <option value="">Selecione…</option>
            {TIPOS_CURSO.map((t) => <option key={t} value={t}>{TABELA_AH[t].nome}</option>)}
          </select></div>
        <div><label htmlFor="md-curso" className="rotulo">Nome do curso</label>
          <input id="md-curso" name="curso" defaultValue={inicial.curso} maxLength={200} className="entrada" /></div>
        <div><label htmlFor="md-pct" className="rotulo">Percentual pedido (%)</label>
          <input id="md-pct" name="percentualPedido" inputMode="decimal" defaultValue={inicial.percentualPedido} className="entrada" /></div>
        <div className="sm:col-span-3"><label htmlFor="md-doc" className="rotulo">Ato que reconheceu o direito (nº e data)</label>
          <input id="md-doc" name="documento" defaultValue={inicial.documento} maxLength={200} placeholder="Ex.: BI nº 123, de 10 MAR 23, do 7º D Sup" className="entrada" /></div>
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="flex justify-end"><button className="botao-sec" disabled={salvando}>{salvando ? "Gravando…" : "Gravar dados do direito"}</button></div>
    </form>
  );
}

type Grade = Record<CampoFicha, string[]>;
const vazia = (): Grade => Object.fromEntries(CAMPOS_FICHA.map((c) => [c, Array(12).fill("")])) as Grade;
const daFicha = (v?: ValoresFicha): Grade => (v ? Object.fromEntries(CAMPOS_FICHA.map((c) => [c, v.meses[c].map(texto)])) as Grade : vazia());

/** Valores da ficha de um ano: digitados (ficha ilegível) ou corrigidos (número mal lido pelo OCR). */
function DigitarFicha({ processoId, anos, fichas }: { processoId: string; anos: number[]; fichas: ValoresFicha[] }) {
  const router = useRouter();
  const porAno = useMemo(() => new Map(fichas.map((f) => [f.ano, f])), [fichas]);
  // abre no ano a corrigir: a ficha lida por OCR com algo a conferir; senão, o primeiro ano sem ficha
  const aConferir = fichas.find((f) => f.origem === "ocr" && !f.editada && (f.conferencia?.meses.length || f.conferencia?.linhas.length || f.conferencia?.incompletas?.length));
  const [ano, setAno] = useState(aConferir?.ano ?? anos.find((a) => !porAno.has(a)) ?? anos[0]!);
  const [grade, setGrade] = useState<Grade>(() => daFicha(porAno.get(ano)));
  const [decimo, setDecimo] = useState(() => texto(porAno.get(ano)?.decimo ?? 0));
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();
  const atual = porAno.get(ano);
  const trocarAno = (a: number) => {
    setAno(a); setGrade(daFicha(porAno.get(a))); setDecimo(texto(porAno.get(a)?.decimo ?? 0)); setMsg(null);
  };
  const origem = !atual ? "sem ficha: os valores digitados criam a ficha deste ano"
    : atual.origem === "ocr" ? `lida por OCR${atual.arquivo ? ` (${atual.arquivo})` : ""}: corrija o que estiver diferente da ficha`
    : atual.origem === "manual" ? "digitada à mão" : `lida do PDF${atual.editada ? ", com valores alterados à mão" : ""}`;
  const suspeitos = new Set(atual?.conferencia?.meses ?? []);

  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setMsg(null);
      const meses = Object.fromEntries(CAMPOS_FICHA.map((c) => [c, grade[c].map(numeroBr)])) as Record<CampoFicha, number[]>;
      const ruins = CAMPOS_FICHA.flatMap((c) => meses[c].map((v, i) => (Number.isNaN(v) ? `${ROTULO_CAMPO[c]} de ${MESES_CURTOS[i]}` : null)).filter(Boolean));
      const d13 = numeroBr(decimo);
      if (ruins.length || Number.isNaN(d13)) return setMsg({ tipo: "erro", texto: `Valor inválido em: ${[...ruins, ...(Number.isNaN(d13) ? ["13º pago"] : [])].join(", ")}. Use o formato 1.234,56.` });
      iniciar(async () => {
        const r = await gravarFichaDigitadaAdicHab(processoId, ano, { meses, decimo: d13 });
        if (r.erro) return setMsg({ tipo: "erro", texto: r.erro });
        setMsg({ tipo: "ok", texto: `Ficha de ${ano} gravada. A análise foi refeita.` });
        router.refresh();
      });
    }}>
      <h3 className="rotulo-secao">Digitar valores da ficha</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="mf-ano" className="rotulo">Ano</label>
          <select id="mf-ano" className="entrada" value={ano} onChange={(e) => trocarAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}{porAno.has(a) ? "" : " (sem ficha)"}</option>)}
          </select></div>
        <p className="pb-2 text-sm text-suave">Ficha de {ano}: {origem}.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead><tr className="text-left text-suave"><th className="py-1 pr-2">Mês</th>{CAMPOS_FICHA.map((c) => <th key={c} className="px-1 font-normal">{ROTULO_CAMPO[c]}</th>)}</tr></thead>
          <tbody>{MESES_CURTOS.map((m, i) => (
            <tr key={m} className={suspeitos.has(i + 1) ? "bg-amber-50" : ""}>
              <td className="py-0.5 pr-2">{m}{suspeitos.has(i + 1) && <span className="ml-1 text-xs text-amber-800" title="O líquido deste mês não fecha na leitura por OCR">conferir</span>}</td>
              {CAMPOS_FICHA.map((c) => (
                <td key={c} className="px-1">
                  <input aria-label={`${ROTULO_CAMPO[c]} de ${m}/${ano}`} inputMode="decimal" value={grade[c][i]} placeholder="0,00"
                    className="entrada py-1 text-right tabular-nums"
                    onChange={(e) => setGrade((g) => ({ ...g, [c]: g[c].map((x, j) => (j === i ? e.target.value : x)) }))} />
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><label htmlFor="mf-13" className="rotulo">13º pago no ano (total das parcelas)</label>
          <input id="mf-13" inputMode="decimal" value={decimo} placeholder="0,00" onChange={(e) => setDecimo(e.target.value)} className="entrada w-44 text-right tabular-nums" /></div>
        <button className="botao-sec" disabled={salvando}>{salvando ? "Gravando…" : `Gravar ficha de ${ano}`}</button>
      </div>
      <p className="ajuda">Digite como está na ficha (NR0001/A01 soldo, NR0003/A03 adicional, AR0003/A23 atrasado, DR0003/G03 desconto do adicional); deixe em branco o que for zero.
        Só esses campos mudam: as demais linhas da ficha lida continuam como estão.</p>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </form>
  );
}

/** Entrada manual da análise do Adicional de Habilitação (só com a análise pendente, nos processos novos). */
export function EntradaManualAnalise({ processoId, direito, anos, fichas, aberto }: {
  processoId: string; direito: DireitoAnalise; anos: number[]; fichas: ValoresFicha[]; aberto: boolean;
}) {
  return (
    <details className="cartao space-y-4" open={aberto}>
      <summary className="cursor-pointer font-semibold">Digitar os dados manualmente (PDF ilegível ou leitura errada)</summary>
      <p className="ajuda mt-2">Use quando o processo ou a ficha não puderem ser lidos, nem por OCR, ou para corrigir um valor lido. O que for gravado aqui refaz a análise na hora.</p>
      <div className="mt-4 space-y-6">
        <DadosDireito processoId={processoId} inicial={direito} />
        <div className="border-t border-borda pt-4"><DigitarFicha processoId={processoId} anos={anos} fichas={fichas} /></div>
      </div>
    </details>
  );
}
