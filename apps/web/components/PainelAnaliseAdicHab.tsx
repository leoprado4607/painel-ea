import { Aviso } from "@/components/Aviso";
import { AcoesAnaliseAdicHab, EscolhaPeriodoAnalise } from "@/components/AcoesAnaliseAdicHab";
import type { AnaliseAdicHab } from "@/lib/analise-adic-hab";
import { formatarReais } from "@/lib/dinheiro";
import { MESES_CURTOS } from "@/lib/tipos";

const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const R = (v: number) => `R$ ${formatarReais(v)}`;
const N = (v: number) => (v ? formatarReais(v) : "-");
const mes = (ano: number, m: number) => `${MESES_CURTOS[m - 1]}/${String(ano).slice(2)}`;
const pct = (v: number) => `${String(v).replace(".", ",")}%`;

function Secao({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="rotulo-secao">{n}. {titulo}</h3>
      {children}
    </section>
  );
}

const ROTULO_ATRASADO: Record<AnaliseAdicHab["atrasados"][number]["tipo"], string> = {
  "percentual-antigo": "Pagamento atrasado do percentual antigo",
  majoracao: "Retroativo da majoração",
  estorno: "Desconto (estorno) do adicional pago",
  "fora-do-periodo": "Fora do período da dívida",
  indefinido: "Não identificado",
};

/**
 * Análise do Adicional de Habilitação (lib/analise-adic-hab): a memória de cálculo que o sistema entende como o pagamento
 * correto, antes das Informações. Só nos processos novos (complementos.analiseAdicHab).
 */
export function PainelAnaliseAdicHab({ processoId, a, valor, estender, pendente }: {
  processoId: string; a: AnaliseAdicHab; estender: boolean; pendente: boolean;
  valor: { semCorrecao: number; corrigido: number; ate: string | null } | null;
}) {
  const t = a.totais;
  return (
    <div className="space-y-5">
      <section className="cartao space-y-3" aria-labelledby="analise-titulo">
        <div>
          <h2 id="analise-titulo" className="text-lg font-semibold">Análise do Adicional de Habilitação: memória de cálculo</h2>
          <p className="ajuda mt-1">
            Antes das Informações, o sistema mostra o que entende como o pagamento correto, a partir do processo e das fichas financeiras, pelo roteiro
            conferido com processos já pagos. Confira cada passo. Se faltar documento, carregue no fim da página e clique em Reanalisar. Ao prosseguir,
            as telas seguintes já vêm preenchidas com esta análise, e você pode alterar qualquer campo.
          </p>
        </div>
        {a.pronta && valor && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border border-borda p-3"><p className="text-sm text-suave">Valor corrigido{valor.ate ? ` (índices até ${valor.ate})` : ""}</p><p className="text-xl font-semibold tabular-nums">{R(valor.corrigido)}</p></div>
            <div className="border border-borda p-3"><p className="text-sm text-suave">Sem correção</p><p className="text-xl font-semibold tabular-nums">{R(valor.semCorrecao)}</p></div>
            <div className="border border-borda p-3"><p className="text-sm text-suave">Período da dívida</p><p className="text-xl font-semibold">{br(a.inicio!)} a {br(a.fim!)}</p></div>
          </div>
        )}
        {a.faltas.length > 0 && (
          <Aviso tipo="atencao">
            <p className="font-semibold">Para completar a análise, faltam:</p>
            <ul className="mt-1 list-disc pl-5">{a.faltas.map((f) => <li key={f}>{f}</li>)}</ul>
          </Aviso>
        )}
      </section>

      {a.pronta && (
        <section className="cartao space-y-5">
          <Secao n={1} titulo="Direito">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Curso: <strong>{a.dados.curso || "não informado"}</strong>, equivalente a <strong>{a.tipoNome}</strong> (Lei nº 13.954/2019, Anexo III; Portaria C Ex nº 1.443/2021).</li>
              <li>Direito a contar de <strong>{br(a.inicio!)}</strong>{a.dados.documento ? <> ({a.dados.documento})</> : null}.</li>
              <li>Adicional recebido à época: <strong>{a.percentualRecebido === null ? "não identificado nas fichas" : pct(a.percentualRecebido)}</strong> (o adicional pago ÷ o soldo, na ficha).</li>
              {a.dados.percentualPedido ? <li>Percentual pedido no requerimento: {pct(a.dados.percentualPedido)}. O cálculo segue a tabela da lei, mesmo que o pedido seja maior.</li> : null}
            </ul>
          </Secao>

          <Secao n={2} titulo="Período">
            <p className="text-sm">Pedido: {a.fimPedido ? `${br(a.inicio!)} a ${br(a.fimPedido)}` : "não lido no processo"}. Usado na análise: <strong>{br(a.inicio!)} a {br(a.fim!)}</strong>.
              A DEA vai só até dezembro do ano anterior; o ano corrente é pago em folha.</p>
            {a.fimPossivel && a.fimPedido && <EscolhaPeriodoAnalise fimPedido={a.fimPedido} fimPossivel={a.fimPossivel} estender={estender} pendente={pendente} />}
          </Secao>

          <Secao n={3} titulo="Percentual da lei em cada período">
            <p className="text-sm">O Anexo III da Lei nº 13.954/2019 sobe o percentual em 1º de julho de cada ano (2020 a 2023). O devido de cada dia é o percentual vigente nele.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="border-b border-borda text-left"><th className="py-1">Vigência</th><th className="text-right">Lei</th><th className="text-right">Recebido</th><th className="text-right">Diferença</th></tr></thead>
                <tbody>{a.faixas.map((f) => (
                  <tr key={f.de} className="border-b border-borda/60"><td className="py-1">{br(f.de)} a {br(f.ate)}</td><td className="text-right">{pct(f.percentual)}</td>
                    <td className="text-right">{a.percentualRecebido === null ? "-" : pct(a.percentualRecebido)}</td><td className="text-right">{f.diferenca === null ? "-" : pct(f.diferenca)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Secao>

          <Secao n={4} titulo="Posto e promoções (soldo da tabela)">
            <ul className="list-disc pl-5 text-sm">{a.postos.map((p) => <li key={p.desde}>{p.nome} desde {br(p.desde)}</li>)}</ul>
            {a.postosSugeridos && <p className="ajuda">Sugerido pelo soldo das fichas (NR0001/A01): a mudança de posto é onde o soldo pago passa a ser o de outro posto (reajuste não conta).</p>}
          </Secao>

          <Secao n={5} titulo="O que as fichas mostram">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Fichas analisadas: {a.fichasAnos.join(", ")}.</li>
              <li>Recebido mês a mês: o adicional pago na ficha (NR0003/A03), na coluna “Recebido” da memória.</li>
              {a.atrasados.length === 0 && <li>Nenhum adicional atrasado (AR0003/ER0003/A23) ou desconto do adicional (G03) no período e no ano seguinte.</li>}
              {a.atrasados.map((x) => (
                <li key={`${x.tipo}-${x.ano}-${x.mes}`}><strong>{ROTULO_ATRASADO[x.tipo]}</strong> ({mes(x.ano, x.mes)}, {R(x.valor)}): {x.explicacao}</li>
              ))}
              {a.atrasados.some((x) => x.meses.length) && <li>O cálculo automático do sistema não conta esses valores sozinho: ao prosseguir, eles entram como <strong>recebidos (ou devidos) digitados</strong> nos meses indicados, com o Fusex e a Pensão Militar proporcionais.</li>}
              <li>Pensão Militar: {pct(a.dados.pensao ?? 10.5)}{a.dados.pensao15 ? " + 1,5%" : ""}{a.descontosDaFicha.pensao ? " (lida nos descontos da ficha)" : " (o padrão)"}. Fusex de dependentes: {a.dados.fusexDependentes ? `${pct(a.dados.fusexDependentes)}${a.descontosDaFicha.dependentes ? " (lido na ficha)" : ""}` : "não"}.</li>
            </ul>
          </Secao>

          <Secao n={6} titulo="Reflexos: adicional natalino e férias">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {a.natalino.length === 0 && <li>Sem diferença de natalino (dezembro fora do período ou sem diferença).</li>}
              {a.natalino.map((n) => <li key={n.ano}><strong>Natalino {n.ano}: {R(n.valor)}.</strong> {n.explicacao}</li>)}
              {a.ferias.length === 0 && <li>Sem adicional de férias pago no período: sem reflexo.</li>}
              {a.ferias.map((f) => <li key={`${f.ano}-${f.mes}`}><strong>Férias {mes(f.ano, f.mes)}: {R(f.valor)}</strong> (1/3 da diferença do mês cheio; a ficha mostra o adicional de férias pago nesse mês com o percentual antigo).</li>)}
            </ul>
          </Secao>

          <Secao n={7} titulo="Descontos">
            <p className="text-sm">Fusex 3% e Pensão Militar {pct(a.dados.pensao ?? 10.5)}{a.dados.pensao15 ? " + 1,5%" : ""}{a.dados.fusexDependentes ? ` e Fusex de dependentes ${pct(a.dados.fusexDependentes)}` : ""}, mês a mês, só sobre a diferença do adicional (não incidem sobre o natalino e as férias), como na folha.</p>
          </Secao>

          <Secao n={8} titulo="Memória de cálculo mês a mês">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-borda text-right">
                    <th className="py-1 text-left">Mês</th><th>Soldo</th><th>% lei</th><th>Dias</th><th>Devido</th><th>Recebido</th><th>Atrasado/estorno</th>
                    <th>Diferença</th><th>Natalino</th><th>Férias</th><th>Fusex</th><th>P Mil</th>{t.dependente ? <th>Fusex dep.</th> : null}<th>Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {a.memoria.map((l) => (
                    <tr key={`${l.ano}-${l.mes}`} className="border-b border-borda/60 text-right">
                      <td className="py-0.5 text-left">{mes(l.ano, l.mes)}</td><td>{l.soldo === null ? "-" : formatarReais(l.soldo)}</td><td>{pct(l.percentual)}</td>
                      <td>{l.dias === l.diasMes ? "cheio" : `${l.dias}/${l.diasMes}`}</td><td>{N(l.devido)}</td><td>{N(l.recebidoFicha)}</td>
                      <td>{l.atrasado ? formatarReais(-l.atrasado) : "-"}</td><td className="font-semibold">{N(l.diferenca)}</td><td>{N(l.natal)}</td><td>{N(l.ferias)}</td>
                      <td>{N(l.fusex)}</td><td>{N(l.pensao + l.pensao15)}</td>{t.dependente ? <td>{N(l.dependente)}</td> : null}<td className="font-semibold">{N(l.liquido)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-borda text-right font-semibold">
                    <td className="py-1 text-left" colSpan={7}>Total (sem correção)</td><td>{N(t.a03)}</td><td>{N(t.natal)}</td><td>{N(t.ferias)}</td>
                    <td>{N(t.fusex)}</td><td>{N(t.pensao + t.pensao15)}</td>{t.dependente ? <td>{N(t.dependente)}</td> : null}<td>{N(t.liquido)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="ajuda">Devido = percentual da lei × soldo da tabela, proporcional aos dias no período. Diferença = devido − recebido − atrasado ligado ao mês (o estorno soma).
              Líquido = diferença + natalino + férias − descontos. A correção monetária usa a série do sistema (IPCA até ago/2025 e IPCA-E depois), a mesma da emissão.</p>
          </Secao>

          {(a.pendencias.length > 0 || a.alertas.length > 0) && (
            <Secao n={9} titulo="Pontos para conferir">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {a.pendencias.map((p) => <li key={p}>{p}</li>)}
                {a.alertas.map((x) => <li key={x.codigo + x.descricao}>{x.descricao}</li>)}
              </ul>
            </Secao>
          )}

          <Secao n={a.pendencias.length || a.alertas.length ? 10 : 9} titulo="Textos sugeridos para o verso">
            <p className="text-sm"><span className="font-semibold">Explicação do não pagamento:</span> {a.textos.explicacao}</p>
            {a.textos.documentos.length > 0 && <p className="text-sm"><span className="font-semibold">Documentos que materializaram o direito:</span> {a.textos.documentos.join("; ")}</p>}
            <p className="ajuda">Ao prosseguir, estes textos vão para o verso. Você pode editá-los em Lançar valor devido (quadro do adicional) ou em Informações.</p>
          </Secao>
        </section>
      )}

      <AcoesAnaliseAdicHab processoId={processoId} pendente={pendente} estender={estender} faltam={a.faltas.length > 0} />
    </div>
  );
}
