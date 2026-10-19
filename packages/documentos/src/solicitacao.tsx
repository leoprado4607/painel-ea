/** "Solicitação NN" (Folha de Cálculo por Exercício) e "Solicitação NN Verso" (Discriminação dos Valores Devidos e Descontos). */
import { Page, Text, View } from "@react-pdf/renderer";
import { Assinaturas, Cabecalho, corDoTipo, e, Linha, mesAno, reais, requerente, Rodape, type Coluna, type DadosDocumentos } from "./comum";

export function Solicitacao({ d, ano }: { d: DadosDocumentos; ano: number }) {
  const a = d.resultado.porAno[ano]!;
  const cols: Coluna[] = [{ largura: "38%" }, { largura: "14%", alinhar: "center" }, { largura: "24%", alinhar: "center" }, { largura: "24%", alinhar: "center" }];
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho d={d} />
      <Text style={[e.centro, { textDecoration: "underline", marginTop: 4 }]}>Folha de Cálculo por Exercício</Text>
      <Text style={[e.centro, e.negrito, { marginVertical: 8 }]}>Exercício - {ano}</Text>
      <View style={{ gap: 3, marginBottom: 4 }}>
        <Text>Requerente: {requerente(d)}</Text>
        <Text>Período: {mesAno(d.processo.periodoInicio)} a {mesAno(d.processo.periodoFim)}</Text>
        <Text>Espécie da Dívida: {d.processo.especieDivida ?? ""}</Text>
        <Text>Importância Básica (A receber - Recebido): R$ {reais(a.importanciaBasica)}</Text>
      </View>
      <View style={e.tabela}>
        <Linha cols={cols} altura={26} estilo={{ textAlign: "center" }}
          valores={["Especificações", "Receitas / Despesas", "Valores Devidos Menos Valores Recebidos - Sem Correção", "Valores Devidos Menos Valores Recebidos - Com Correção"]} />
        {d.rubricas.map((r, p) => {
          const cor = r.codigo ? corDoTipo(r.tipo) : undefined;
          return (
            <Linha key={p} cols={cols} estilo={{}} cores={[undefined, undefined, cor, cor]}
              valores={[r.codigo, r.codigo ? r.tipo : "", reais(a.verso.diferenca[p]!), reais(a.verso.corrigido[p]!)]} />
          );
        })}
        <Linha cols={cols} estilo={e.negrito} valores={["TOTAL", "-", reais(a.verso.total.diferenca), reais(a.verso.total.corrigido)]} />
      </View>
      <Assinaturas d={d} />
      <Rodape d={d} nome={`Solicitação ${ano}`} />
    </Page>
  );
}

export function SolicitacaoVerso({ d, ano }: { d: DadosDocumentos; ano: number }) {
  const a = d.resultado.porAno[ano]!;
  const cols: Coluna[] = [
    { largura: "30%" }, { largura: "8%", alinhar: "center" }, { largura: "15.5%", alinhar: "center" },
    { largura: "15.5%", alinhar: "center" }, { largura: "15.5%", alinhar: "center" }, { largura: "15.5%", alinhar: "center" },
  ];
  return (
    <Page size="A4" style={e.pagina}>
      <Text style={[e.centro, { marginTop: 10 }]}>Folha de Cálculo por Exercício (VERSO)</Text>
      <Text style={e.centro}>Discriminação dos Valores Devidos e Descontos</Text>
      <Text style={[e.centro, e.negrito, { marginVertical: 14 }]}>Ano de {ano}</Text>
      <View style={e.tabela}>
        <Linha cols={cols} altura={34} estilo={{ textAlign: "center", fontSize: 7.5 }}
          valores={["Especificações", "R/D", "Valores Devidos Sem Correção", "Valores Recebidos Sem Correção",
            "Valores Devidos Menos Valores Recebidos - Sem Correção", "Valores Devidos Menos Valores Recebidos - Com Correção"]} />
        {d.rubricas.map((r, p) => {
          const cor = r.codigo ? corDoTipo(r.tipo) : undefined;
          return (
            <Linha key={p} cols={cols} cores={[undefined, undefined, cor, cor, cor, cor]}
              valores={[r.codigo, r.codigo ? r.tipo : "", reais(a.verso.devido[p]!), reais(a.verso.recebido[p]!), reais(a.verso.diferenca[p]!), reais(a.verso.corrigido[p]!)]} />
          );
        })}
        <Linha cols={cols} estilo={e.negrito}
          valores={["TOTAL (SAQUES - DESCONTOS)", "-", reais(a.verso.total.devido), reais(a.verso.total.recebido), reais(a.verso.total.diferenca), reais(a.verso.total.corrigido)]} />
      </View>
      <Assinaturas d={d} data={false} />
      <Rodape d={d} nome={`Solicitação ${ano} Verso`} />
    </Page>
  );
}
