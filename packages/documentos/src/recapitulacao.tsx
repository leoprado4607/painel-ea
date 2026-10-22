/** "Solicitação Recapitulação": receitas, descontos e valor líquido corrigidos, ano a ano. */
import { Page, Text, View } from "@react-pdf/renderer";
import { anosDoPeriodo, Assinaturas, Cabecalho, dataBr, e, Linha, reais, requerente, Rodape, type Coluna, type DadosDocumentos } from "./comum";

export function Recapitulacao({ d }: { d: DadosDocumentos }) {
  const r = d.resultado.recapitulacao;
  // conteúdo de todas as células centralizado (pedido de 21/10/2026)
  const cols: Coluna[] = [
    { largura: "11%", alinhar: "center" }, { largura: "17%", alinhar: "center" }, { largura: "38%", alinhar: "center" },
    { largura: "16%", alinhar: "center" }, { largura: "18%", alinhar: "center" },
  ];
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho d={d} />
      <Text style={e.titulo}>Folha de Cálculo Recapitulação</Text>
      <View style={{ gap: 2, marginBottom: 6 }}>
        <Text>Requerente: {requerente(d)}</Text>
        <Text>Período: {dataBr(d.processo.periodoInicio)} a {dataBr(d.processo.periodoFim)}</Text>
        <Text>Espécie da Dívida: {d.processo.especieDivida ?? ""}</Text>
        <Text>Importância Básica Total Corrigida: R$ {reais(r.saldo)}</Text>
      </View>
      <View style={e.tabela}>
        <Linha cols={cols} altura={22} estilo={{ textAlign: "center", fontSize: 7.5 }}
          valores={["EXERCÍCIOS (ANOS)", "RECEITAS DEVIDAS CORRIGIDAS", "DESCONTOS DEVIDOS CORRIGIDOS – TÍTULO", "DESCONTOS – VALOR", "VALOR DEVIDO LÍQUIDO"]} />
        {anosDoPeriodo(d).map((ano) => {
          const x = r.porAno[ano] ?? { receitas: 0, despesas: 0, saldo: 0 };
          return <Linha key={ano} cols={cols} altura={22}
            valores={[String(ano), reais(x.receitas), d.resultado.despesasCompactadas, reais(x.despesas), reais(x.saldo)]} />;
        })}
        <Linha cols={cols} estilo={e.negrito} valores={["S O M A", reais(r.receitas), "R$", reais(r.despesas), reais(r.saldo)]} />
      </View>
      <Assinaturas d={d} />
      <Rodape d={d} nome="Recapitulação" />
    </Page>
  );
}
