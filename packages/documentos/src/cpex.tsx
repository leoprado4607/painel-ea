/** "CPEX": Folha de Cálculo para ser informado ao CPEx (totais do período por rubrica, sem e com correção). */
import { Page, Text, View } from "@react-pdf/renderer";
import { quantidadeMeses } from "@painel-ea/engine";
import { Assinaturas, corDoTipo, e, Linha, mesAno, reais, requerente, Rodape, type Coluna, type DadosDocumentos } from "./comum";

const Campo = ({ rotulo, valor, largura = "auto" }: { rotulo: string; valor: string; largura?: number | string }) => (
  <View style={[e.linha, { width: largura, marginRight: 10 }]}>
    <Text style={{ marginRight: 4 }}>{rotulo}</Text>
    <Text style={{ borderBottomWidth: 0.5, flexGrow: 1, paddingHorizontal: 2 }}>{valor}</Text>
  </View>
);

export function Cpex({ d }: { d: DadosDocumentos }) {
  const c = d.resultado.cpex;
  const ini = d.processo.periodoInicio, fim = d.processo.periodoFim;
  const meses = quantidadeMeses({ ano: +ini.slice(0, 4), mes: +ini.slice(5, 7) }, { ano: +fim.slice(0, 4), mes: +fim.slice(5, 7) });
  const cols: Coluna[] = [{ largura: "30%" }, { largura: "10%", alinhar: "center" }, { largura: "20%", alinhar: "center" }, { largura: "20%", alinhar: "center" }, { largura: "20%", alinhar: "center" }];
  const periodo = `${mesAno(ini)} a ${mesAno(fim)}`;
  // coluna "Período da Dívida" mesclada da 1ª rubrica até o TOTAL: as células não têm a borda de baixo (só a última)
  const mesclada = [undefined, undefined, undefined, { borderBottomWidth: 0 }, undefined];
  const pj = d.complementos?.pensao ?? {}, op = d.complementos?.operadorCpex ?? {};
  return (
    <Page size="A4" style={e.pagina}>
      <Text style={e.titulo}>Folha de Cálculo para ser informado ao CPEx</Text>
      <View style={{ gap: 6, marginVertical: 6 }}>
        <Campo rotulo="Requerente:" valor={requerente(d)} />
        <View style={e.linha}>
          <Campo rotulo="PREC-CP:" valor={d.militar.precCp ?? ""} largura="45%" />
          <Campo rotulo="CPF:" valor={d.militar.cpf ?? ""} largura="45%" />
        </View>
        <View style={e.linha}>
          <Campo rotulo="BANCO:" valor={d.militar.banco ?? ""} largura="35%" />
          <Campo rotulo="AG:" valor={d.militar.agencia ?? ""} largura="25%" />
          <Campo rotulo="C/C:" valor={d.militar.conta ?? ""} largura="30%" />
        </View>
        <View style={e.linha}>
          <Campo rotulo="Período Total da Dívida:" valor={periodo} largura="65%" />
          <Campo rotulo="MESES:" valor={String(meses)} largura="25%" />
        </View>
        <Campo rotulo="Espécie da Dívida:" valor={d.processo.especieDivida ?? ""} />
        <Text style={e.negrito}>Importância Básica Total Corrigida: R$ {reais(c.importanciaBasicaTotalCorrigida)}</Text>
      </View>
      <View style={e.tabela}>
        <Linha cols={cols} altura={30} estilo={{ textAlign: "center", fontSize: 7.5 }}
          valores={["ESPECIFICAÇÕES", "R/D", "Valores Devidos Menos Valores Recebidos - Sem Correção", "PERÍODO DA DÍVIDA", "Valores Devidos Menos Valores Recebidos - Com Correção"]} />
        <View style={{ position: "relative" }}>
          {d.rubricas.map((r, p) => {
            const cor = r.codigo ? corDoTipo(r.tipo) : undefined;
            return <Linha key={p} cols={cols} cores={[undefined, undefined, cor, undefined, cor]} celulas={mesclada}
              valores={[r.codigo, r.codigo ? r.tipo : "", reais(c.semCorrecao[p]!), "", reais(c.comCorrecao[p]!)]} />;
          })}
          <Linha cols={cols} estilo={e.negrito} valores={["TOTAL", "", reais(c.totalSemCorrecao), "", reais(c.totalComCorrecao)]} />
          {/* texto da célula mesclada, centralizado na altura de todas as linhas (rubricas e TOTAL) */}
          <View style={{ position: "absolute", left: "60%", width: "20%", top: 0, bottom: 0, justifyContent: "center", padding: 4 }}>
            <Text style={{ textAlign: "center", fontSize: 7.5 }}>
              Valor corrigido pela série {d.descricaoIndice}, atualizada até {d.indiceAte}, referente a todos os anos do Período Total da Dívida: {periodo}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ marginTop: 10, gap: 6 }} wrap={false}>
        <View style={e.linha}>
          <Text style={[e.negrito, { width: "60%" }]}>POSSUI PENSÃO JUDICIAL NO PERÍODO DA DÍVIDA:</Text>
          <Text style={{ width: "20%" }}>SIM {d.processo.possuiPensaoJudicial ? "( X )" : "(   )"}</Text>
          <Text style={{ width: "20%" }}>NÃO {d.processo.possuiPensaoJudicial ? "(   )" : "( X )"}</Text>
        </View>
        {d.processo.possuiPensaoJudicial ? (
          <>
            <View style={e.linha}><Campo rotulo="NOME:" valor={pj.nome ?? ""} largura="60%" /><Campo rotulo="CPF:" valor={pj.cpf ?? ""} largura="35%" /></View>
            <View style={e.linha}><Campo rotulo="BANCO:" valor={pj.banco ?? ""} largura="30%" /><Campo rotulo="AGÊNCIA:" valor={pj.agencia ?? ""} largura="30%" /><Campo rotulo="CONTA:" valor={pj.conta ?? ""} largura="30%" /></View>
            <Text>VALOR CORRIGIDO (pensão judiciária): R$ {reais(c.valorCorrigidoPensaoJudicial)}</Text>
          </>
        ) : (
          <Text>Militar não possuía Pensão Judicial no período da Dívida.</Text>
        )}
      </View>
      <Assinaturas d={d} />
      <View style={[e.linha, { marginTop: 14 }]}>
        <Campo rotulo="NOME/OP:" valor={op.nome ?? ""} largura="60%" /><Campo rotulo="CPF:" valor={op.cpf ?? ""} largura="35%" />
      </View>
      <Rodape d={d} nome="CPEX" />
    </Page>
  );
}
