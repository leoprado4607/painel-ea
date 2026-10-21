/** "Resumo": a receber, recebido e líquido (sem correção) por rubrica, dois anos lado a lado. */
import { Page, Text, View } from "@react-pdf/renderer";
import { anosDoPeriodo, Cabecalho, e, Linha, reais, requerente, Rodape, type Coluna, type DadosDocumentos } from "./comum";

export function Resumo({ d }: { d: DadosDocumentos }) {
  const anos = anosDoPeriodo(d);
  const pares: number[][] = [];
  for (let i = 0; i < anos.length; i += 2) pares.push(anos.slice(i, i + 2));
  const cols: Coluna[] = [{ largura: "22%" }, { largura: "9.33%", alinhar: "right" }, { largura: "9.33%", alinhar: "right" }, { largura: "9.34%", alinhar: "right" },
    { largura: "22%" }, { largura: "9.33%", alinhar: "right" }, { largura: "9.33%", alinhar: "right" }, { largura: "9.34%", alinhar: "right" }];
  // ano sem par (período de um ano ou último ano ímpar): só as 4 colunas dele, numa tabela de meia página centralizada
  const colsSozinho: Coluna[] = [{ largura: "44%" }, { largura: "18.66%", alinhar: "right" }, { largura: "18.67%", alinhar: "right" }, { largura: "18.67%", alinhar: "right" }];
  const lado = (ano: number | undefined, p: number | "total") => {
    if (ano === undefined) return ["", "", "", ""];
    const v = d.resultado.porAno[ano]!.verso;
    if (p === "total") return ["TOTAL LÍQUIDO", reais(v.total.devido), reais(v.total.recebido), reais(v.total.diferenca)];
    return [d.rubricas[p]!.codigo, reais(v.devido[p]!), reais(v.recebido[p]!), reais(v.diferenca[p]!)];
  };
  return (
    <Page size="A4" style={[e.pagina, { fontSize: 6.8 }]}>
      <Cabecalho d={d} brasao={false} />
      <Text style={[e.centro, e.negrito, { marginBottom: 4 }]}>
        Resumo Geral do a Receber e o Valor Recebido (SEM CORREÇÃO) dos Anos de {anos[0]} a {anos[anos.length - 1]}
      </Text>
      <Text style={{ marginBottom: 4 }}>Nome: {requerente(d)}</Text>
      {pares.map(([a1, a2]) => a2 ? (
        <View key={a1} style={[e.tabela, { marginBottom: 6 }]} wrap={false}>
          <Linha cols={cols} estilo={e.negrito}
            valores={[`Especificação ${a1}`, "A Receber", "Recebido", "Líquido", `Especificação ${a2}`, "A Receber", "Recebido", "Líquido"]} />
          {d.rubricas.map((_, p) => <Linha key={p} cols={cols} valores={[...lado(a1, p), ...lado(a2, p)]} />)}
          <Linha cols={cols} estilo={e.negrito} valores={[...lado(a1, "total"), ...lado(a2, "total")]} />
        </View>
      ) : (
        <View key={a1} style={[e.tabela, { marginBottom: 6, width: "50%", alignSelf: "center" }]} wrap={false}>
          <Linha cols={colsSozinho} estilo={e.negrito} valores={[`Especificação ${a1}`, "A Receber", "Recebido", "Líquido"]} />
          {d.rubricas.map((_, p) => <Linha key={p} cols={colsSozinho} valores={lado(a1!, p)} />)}
          <Linha cols={colsSozinho} estilo={e.negrito} valores={lado(a1!, "total")} />
        </View>
      ))}
      <Rodape d={d} nome="Resumo" />
    </Page>
  );
}
