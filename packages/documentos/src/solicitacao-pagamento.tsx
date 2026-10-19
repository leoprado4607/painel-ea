/** "Solicitação" e "Solicitação Verso" da planilha: folha de rosto do pedido de pagamento ao Ordenador de Despesas. */
import { Page, Text, View } from "@react-pdf/renderer";
import {
  anexos, Assinaturas, Cabecalho, dataBr, e, mesAno, numeroOrdem, PARECER_PADRAO, reais, Rodape, type DadosDocumentos,
} from "./comum";

const borda = { borderWidth: 0.6, borderColor: "#000" } as const;
const vazio = "______________________________";

/** Ordenador de Despesas: quem pede o pagamento (frente) e quem dá o parecer (verso). */
function AssinaturaOd({ d }: { d: DadosDocumentos }) {
  return (
    <View style={{ alignItems: "center", marginTop: 16 }} wrap={false}>
      <Text style={e.negrito}>{d.om.ordenadorNome ? d.om.ordenadorNome.toUpperCase() : vazio}</Text>
      <Text>{d.om.ordenadorFuncao ?? "Ordenador de Despesas"}</Text>
    </View>
  );
}

export function SolicitacaoPagamento({ d }: { d: DadosDocumentos }) {
  const r = d.resultado.recapitulacao;
  const pensao = d.resultado.cpex.valorCorrigidoPensaoJudicial;
  const m = d.militar;
  const local = [d.om.cidadeUf, d.processo.dataExtenso].filter(Boolean).join(", ");
  return (
    <Page size="A4" style={e.pagina}>
      <Cabecalho d={d} />
      <Text style={[e.centro, e.negrito, { fontSize: 10, marginVertical: 6 }]}>SOLICITAÇÃO DE PAGAMENTO Nº {numeroOrdem(d) || "______/______"}</Text>

      <View style={[e.linha, { gap: 10, marginBottom: 8 }]}>
        <View style={{ width: "62%", gap: 4 }}>
          <Text>Do OD do(a): {d.om.nome}</Text>
          <Text style={e.negrito}>Ao Sr Ordenador de Despesas</Text>
          <Text>Cod UG: {d.om.unidadeGestora ?? ""}        CODOM: {d.om.codom ?? ""}</Text>
          <Text style={{ marginTop: 2 }}>Solicito o pagamento de despesas por mim reconhecidas e declaro não haver duplicidade.</Text>
          <Text style={[e.negrito, { marginTop: 4 }]}>Anexos:</Text>
          {anexos(d).filter((a) => a.qtd).map((a) => <Text key={a.texto}>  ( {a.qtd} ) {a.texto}</Text>)}
          <Text style={{ marginTop: 6 }}>{local}</Text>
          <AssinaturaOd d={d} />
        </View>
        <View style={[borda, { width: "38%", padding: 6, gap: 6 }]}>
          <Text style={[e.centro, e.negrito]}>Reservado ao OD Órgãos responsáveis ou OD CPEx</Text>
          <Text>Apreciado em: ____/____/______</Text>
          <Text>Duplicidade: __________________</Text>
          <View style={{ alignItems: "center", marginTop: 14 }}><Text>{vazio}</Text><Text>Chefe da Seção de Pagamento Pessoal</Text></View>
          <View style={{ alignItems: "center", marginTop: 14 }}><Text>{vazio}</Text><Text>OD do órgão responsável ou OD CPEx</Text></View>
        </View>
      </View>

      <View style={[borda, { flexDirection: "row" }]}>
        {[
          { w: "11%", t: "Nº de Ordem" }, { w: "31%", t: "Posto/Grad, Nome do Interessado, Nº Idt, Prec-CP, CPF e Situação" },
          { w: "13%", t: "Período Total da Dívida" }, { w: "13%", t: "Receitas Devidas Corrigidas" },
          { w: "19%", t: "Despesas Devidas Corrigidas (Título / Valores Somados)" }, { w: "13%", t: "Valor Líquido Devido" },
        ].map((c, i) => (
          <Text key={i} style={[e.negrito, e.centro, { width: c.w, padding: 3, fontSize: 7.5, borderLeftWidth: i ? 0.6 : 0 }]}>{c.t}</Text>
        ))}
      </View>
      <View style={[borda, { borderTopWidth: 0, flexDirection: "row", minHeight: 80 }]}>
        <Text style={[e.centro, { width: "11%", padding: 3, fontSize: 7.5 }]}>{numeroOrdem(d)}</Text>
        <View style={{ width: "31%", padding: 3, gap: 1.5, borderLeftWidth: 0.6 }}>
          <Text>Pst/Grad: {m.postoGraduacao ?? ""}</Text>
          <Text>Nome: {m.nome.toUpperCase()}</Text>
          <Text>Identidade: {m.identidade ?? ""}</Text>
          <Text>Prec-CP: {m.precCp ?? ""}</Text>
          <Text>CPF: {m.cpf ?? ""}</Text>
          <Text>Situação: {m.situacao ?? ""}</Text>
        </View>
        <Text style={[e.centro, { width: "13%", padding: 3, borderLeftWidth: 0.6 }]}>
          {mesAno(d.processo.periodoInicio)} a {mesAno(d.processo.periodoFim)}
        </Text>
        <Text style={{ width: "13%", padding: 3, textAlign: "right", borderLeftWidth: 0.6 }}>{reais(r.receitas)}</Text>
        <View style={{ width: "19%", padding: 3, gap: 3, borderLeftWidth: 0.6 }}>
          <Text style={{ fontSize: 7 }}>{d.resultado.despesasCompactadas}</Text>
          <Text style={{ textAlign: "right" }}>{reais(r.despesas)}</Text>
          <Text style={{ fontSize: 7 }}>ZED PJud EA: R$ {reais(pensao)}</Text>
        </View>
        <Text style={[e.negrito, { width: "13%", padding: 3, textAlign: "right", borderLeftWidth: 0.6 }]}>{reais(r.receitas - r.despesas)}</Text>
      </View>
      <Text style={{ marginTop: 6, fontSize: 7.5 }}>
        Observação: cálculos já corrigidos pela série {d.descricaoIndice} (Port Normativa nº 40/MD, de 21 Jan 2004, do Ministério da Defesa,
        transcrita no DOU nº 15, de 22 de janeiro de 2004 - 1ª Seção - pág 28). Processo atualizado até: {d.indiceAte}.
      </Text>
      <Assinaturas d={d} data={false} />
      <Rodape d={d} nome="Solicitação de Pagamento" />
    </Page>
  );
}

export function SolicitacaoPagamentoVerso({ d }: { d: DadosDocumentos }) {
  const c = d.complementos ?? {};
  const bi = d.processo.biNumero ? `BI/Adt ${d.processo.biNumero}${d.processo.biData ? ` de ${dataBr(d.processo.biData)}` : ""}` : "";
  const cols = [
    { w: "10%", t: "Nº de Ordem", v: numeroOrdem(d) },
    { w: "11%", t: "Data do Requerimento", v: dataBr(d.processo.dataRequerimento) },
    { w: "30%", t: "Nº/Data Doc/Materializou Direito", v: c.amparo ?? "" },
    { w: "12%", t: "Boletim que Averbou", v: bi },
    { w: "37%", t: "Explicação do não pagamento à época devida", v: c.explicacao ?? "" },
  ];
  return (
    <Page size="A4" style={e.pagina}>
      <Text style={[e.centro, e.negrito, { marginTop: 10 }]}>Folha de Solicitação de Pagamento</Text>
      <Text style={[e.centro, { marginBottom: 12 }]}>(Verso)</Text>
      <View style={[borda, { flexDirection: "row" }]}>
        {cols.map((x, i) => <Text key={i} style={[e.negrito, e.centro, { width: x.w, padding: 3, fontSize: 7.5, borderLeftWidth: i ? 0.6 : 0 }]}>{x.t}</Text>)}
      </View>
      <View style={[borda, { borderTopWidth: 0, flexDirection: "row", minHeight: 360 }]}>
        {cols.map((x, i) => (
          <Text key={i} style={[{ width: x.w, padding: 3, fontSize: 7.5, borderLeftWidth: i ? 0.6 : 0, textAlign: i === 2 || i === 4 ? "justify" : i < 2 ? "center" : "left" }]}>{x.v}</Text>
        ))}
      </View>
      <Text style={{ marginTop: 14 }}>{c.parecer?.trim() || PARECER_PADRAO}</Text>
      <Text style={[e.centro, e.negrito, { marginTop: 14 }]}>{[d.om.cidadeUf, d.processo.dataExtenso].filter(Boolean).join(", ")}</Text>
      <AssinaturaOd d={d} />
      <Rodape d={d} nome="Solicitação de Pagamento (Verso)" />
    </Page>
  );
}
