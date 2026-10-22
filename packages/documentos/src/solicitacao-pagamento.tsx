/** "Solicitação" e "Solicitação Verso" da planilha: folha de rosto do pedido de pagamento ao Ordenador de Despesas. */
import { trechosFormatados } from "@painel-ea/engine";
import { Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  anexos, Assinaturas, Cabecalho, dataBr, e, numeroOrdem, PARECER_PADRAO, reais, Rodape, type DadosDocumentos,
} from "./comum";

const borda = { borderWidth: 0.6, borderColor: "#000" } as const;
const vazio = "______________________________";

/** Texto dos quadros de Informações com negrito, itálico e sublinhado, na Helvetica dos demais documentos. */
function Formatado({ marcacao }: { marcacao?: string }): ReactNode {
  return trechosFormatados(marcacao).map((t, i) => (
    <Text key={i} style={{
      fontFamily: t.negrito ? (t.italico ? "Helvetica-BoldOblique" : "Helvetica-Bold") : t.italico ? "Helvetica-Oblique" : "Helvetica",
      textDecoration: t.sublinhado ? "underline" : "none",
    }}>{t.texto}</Text>
  ));
}

/** Célula da tabela da Solicitação: conteúdo centralizado na horizontal e na vertical. */
const celula = (largura: string, i: number) =>
  ({ width: largura, padding: 3, borderLeftWidth: i ? 0.6 : 0, justifyContent: "center", alignItems: "center" }) as const;

/**
 * O gerador de PDF só quebra linha em espaço: um número longo sem espaço ("640093.005344/2026-43/2026") invadia a
 * coluna ao lado. Quebra em linhas depois de "." e "/", com até 12 caracteres por linha (largura da coluna):
 * "640093." / "005344/" / "2026-43/2026".
 */
function quebravel(t: string, porLinha = 12): string {
  const linhas: string[] = [];
  for (const parte of t.split(/(?<=[./])/)) {
    const u = linhas.length - 1;
    if (u >= 0 && (linhas[u]! + parte).length <= porLinha) linhas[u] += parte;
    else linhas.push(parte);
  }
  return linhas.join("\n");
}

/** Espaço para a assinatura à mão entre a data e o nome de quem assina (pedido de 21/10/2026). */
const ESPACO_ASSINATURA = 40;

/** Ordenador de Despesas: quem pede o pagamento (frente) e quem dá o parecer (verso). */
function AssinaturaOd({ d }: { d: DadosDocumentos }) {
  return (
    <View style={{ alignItems: "center", marginTop: ESPACO_ASSINATURA }} wrap={false}>
      <Text style={e.negrito}>{d.om.ordenadorNome || vazio}</Text>
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
      <Cabecalho d={d} om={d.om.omOrdenador} />
      {/* número abaixo do título e 2 linhas a mais antes do corpo */}
      <View style={{ marginTop: 6, marginBottom: 30 }}>
        <Text style={[e.centro, e.negrito, { fontSize: 10 }]}>SOLICITAÇÃO DE PAGAMENTO</Text>
        <Text style={[e.centro, e.negrito, { fontSize: 10 }]}>Processo Nº {numeroOrdem(d) || "______/______"}</Text>
      </View>

      <View style={[e.linha, { gap: 10, marginBottom: 8 }]}>
        <View style={{ width: "62%", gap: 4 }}>
          <Text>Do OD do(a): {d.om.omOrdenador || d.om.nome}</Text>
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
      {/* conteúdo de todas as células centralizado (na horizontal e na vertical) */}
      <View style={[borda, { borderTopWidth: 0, flexDirection: "row", minHeight: 80 }]}>
        <View style={celula("11%", 0)}><Text style={{ textAlign: "center", fontSize: 7.5 }}>{quebravel(numeroOrdem(d))}</Text></View>
        <View style={[celula("31%", 1), { gap: 1.5 }]}>
          <Text style={e.centro}>Pst/Grad: {m.postoGraduacao ?? ""}</Text>
          <Text style={e.centro}>Nome: {m.nome.toUpperCase()}</Text>
          <Text style={e.centro}>Identidade: {m.identidade ?? ""}</Text>
          <Text style={e.centro}>Prec-CP: {m.precCp ?? ""}</Text>
          <Text style={e.centro}>CPF: {m.cpf ?? ""}</Text>
          <Text style={e.centro}>Situação: {m.situacao ?? ""}</Text>
        </View>
        <View style={celula("13%", 2)}>
          {/* datas completas, como em Informações; sem hifenizar as datas */}
          <Text style={e.centro} hyphenationCallback={(p) => [p]}>{dataBr(d.processo.periodoInicio)} a {dataBr(d.processo.periodoFim)}</Text>
        </View>
        <View style={celula("13%", 3)}><Text style={e.centro}>{reais(r.receitas)}</Text></View>
        <View style={[celula("19%", 4), { gap: 3 }]}>
          <Text style={[e.centro, { fontSize: 7 }]}>{d.resultado.despesasCompactadas}</Text>
          <Text style={e.centro}>{reais(r.despesas)}</Text>
          <Text style={[e.centro, { fontSize: 7 }]}>ZED PJud EA: R$ {reais(pensao)}</Text>
        </View>
        <View style={celula("13%", 5)}><Text style={[e.negrito, e.centro]}>{reais(r.receitas - r.despesas)}</Text></View>
      </View>
      <Text style={{ marginTop: 6, fontSize: 7.5 }}>
        Observação: cálculos já corrigidos pela série {d.descricaoIndice} (Port Normativa nº 40/MD, de 21 Jan 2004, do Ministério da Defesa,
        transcrita no DOU nº 15, de 22 de janeiro de 2004 - 1ª Seção - pág 28). Processo atualizado até: {d.indiceAte}.
      </Text>
      <Assinaturas d={d} data={false} espaco={ESPACO_ASSINATURA} />
      <Rodape d={d} nome="Solicitação de Pagamento" />
    </Page>
  );
}

export function SolicitacaoPagamentoVerso({ d }: { d: DadosDocumentos }) {
  const c = d.complementos ?? {};
  const bi = d.processo.boletimAverbou
    ?? (d.processo.biNumero ? `BI/Adt ${d.processo.biNumero}${d.processo.biData ? ` de ${dataBr(d.processo.biData)}` : ""}` : "");
  // amparo e explicação vêm dos quadros de Informações, com negrito/itálico/sublinhado
  const cols: { w: string; t: string; v: ReactNode }[] = [
    { w: "10%", t: "Nº de Ordem", v: quebravel(numeroOrdem(d), 11) },
    { w: "11%", t: "Data do Requerimento", v: dataBr(d.processo.dataRequerimento) },
    { w: "30%", t: "Nº/Data Doc/Materializou Direito", v: <Formatado marcacao={c.amparo} /> },
    { w: "12%", t: "Boletim que Averbou", v: bi },
    { w: "37%", t: "Explicação do não pagamento à época devida", v: <Formatado marcacao={c.explicacao} /> },
  ];
  return (
    <Page size="A4" style={e.pagina}>
      <Text style={[e.centro, e.negrito, { marginTop: 10 }]}>Folha de Solicitação de Pagamento</Text>
      <Text style={[e.centro, { marginBottom: 12 }]}>(Verso)</Text>
      <View style={[borda, { flexDirection: "row" }]}>
        {/* títulos sem hifenização: palavra longa ("Requerimento") vai inteira para a linha de baixo */}
        {cols.map((x, i) => <Text key={i} style={[e.negrito, e.centro, { width: x.w, padding: 3, fontSize: 7.5, borderLeftWidth: i ? 0.6 : 0 }]}
          hyphenationCallback={(palavra) => [palavra]}>{x.t}</Text>)}
      </View>
      <View style={[borda, { borderTopWidth: 0, flexDirection: "row", minHeight: 360 }]}>
        {cols.map((x, i) => (
          <Text key={i} style={[{ width: x.w, padding: 3, fontSize: 7.5, borderLeftWidth: i ? 0.6 : 0, textAlign: i >= 2 ? "justify" : "center" }]}>{x.v}</Text>
        ))}
      </View>
      <Text style={{ marginTop: 14 }}>{c.parecer?.trim() || PARECER_PADRAO}</Text>
      <Text style={[e.centro, e.negrito, { marginTop: 14 }]}>{[d.om.cidadeUf, d.processo.dataExtenso].filter(Boolean).join(", ")}</Text>
      <AssinaturaOd d={d} />
      <Rodape d={d} nome="Solicitação de Pagamento (Verso)" />
    </Page>
  );
}
