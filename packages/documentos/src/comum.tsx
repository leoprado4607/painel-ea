/** Peças comuns dos documentos: dados de entrada, formatação, cabeçalho com brasão, tabelas e assinaturas. */
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ResultadoCalculo, TipoRubrica } from "@painel-ea/engine";
import type { ReactNode } from "react";
import { BRASAO_PNG } from "./brasao";

/** Textos e campos de preenchimento editáveis nas abas dos documentos (nada aqui altera valores calculados). */
export interface Complementos {
  /** Quantidades da lista de anexos da Solicitação de Pagamento (vazio = padrão calculado). */
  anexos?: { fichas?: number | null; folhasCalculo?: number | null; recapitulacao?: number | null; comprovacao?: number | null; bi?: number | null };
  /** Verso: documento que materializou o direito. */
  amparo?: string;
  /** Verso: explicação do não pagamento à época devida. */
  explicacao?: string;
  /** Verso: parecer (padrão: "Sou de parecer que o requerimento deve ser atendido."). */
  parecer?: string;
  /** CPEX: beneficiário da pensão judicial. */
  pensao?: { nome?: string; cpf?: string; banco?: string; agencia?: string; conta?: string };
  /** CPEX: operador que fará o lançamento no sistema. */
  operadorCpex?: { nome?: string; cpf?: string };
}

export const PARECER_PADRAO = "Sou de parecer que o requerimento deve ser atendido.";

export interface DadosDocumentos {
  om: {
    nome: string; regiaoMilitar: string | null; cidadeUf: string | null;
    unidadeGestora?: string | null; codom?: string | null;
    /** Ordenador de Despesas: assina a Solicitação de Pagamento e o Verso. */
    ordenadorNome?: string | null; ordenadorFuncao?: string | null;
  };
  /** Quem assina os documentos: o operador que gerou o PDF (ex.: "Cb Fulano de Tal", "Auxiliar Div Pg Pes"). */
  responsavel: { nome: string | null; funcao: string };
  militar: {
    postoGraduacao: string | null; nome: string; precCp: string | null; identidade: string | null; cpf: string | null;
    banco: string | null; agencia: string | null; conta: string | null; situacao?: string | null;
  };
  processo: {
    numero: string | null; especieDivida: string | null; periodoInicio: string; periodoFim: string;
    dataExtenso: string; possuiPensaoJudicial: boolean;
    ano?: number | null; dataRequerimento?: string | null; biNumero?: string | null; biData?: string | null;
    /** "Boletim que Averbou" já montado (ex.: "Adt 12 ao BI 045 - 17º GAC, de 20/09/2026"). */
    boletimAverbou?: string | null;
  };
  complementos?: Complementos;
  rubricas: { posicao: number; codigo: string; tipo: TipoRubrica }[];
  resultado: ResultadoCalculo;
  /** Ex.: "IPCA até ago/2025 e IPCA-E a partir de set/2025" */
  descricaoIndice: string;
  /** Ex.: "Setembro/2026" */
  indiceAte: string;
  /** Rodapé de rastreabilidade (ex.: "Processo 001/2026 · emitido em 17/10/2026 · versão 1 · sha256 …") */
  rodape: string;
}

const fmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const reais = (v: number) => fmt.format(v);
export const traco = (v: number) => (v === 0 ? "-" : fmt.format(v));
export const pct = (v: number) => `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(v * 100)}%`;
export const mesAno = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const anosDoPeriodo = (d: DadosDocumentos) => {
  const ini = Number(d.processo.periodoInicio.slice(0, 4)), fim = Number(d.processo.periodoFim.slice(0, 4));
  return Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
};
/** "12/2026" (número e ano do processo), ou "" se não houver número. */
export const numeroOrdem = (d: DadosDocumentos) => [d.processo.numero, d.processo.ano].filter(Boolean).join("/");
/** "2026-10-17" → "17/10/2026" */
export const dataBr = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");
/** Anexos com os padrões: uma ficha e uma folha de cálculo por ano do período; um de cada nos demais. */
export function anexos(d: DadosDocumentos) {
  const n = anosDoPeriodo(d).length, a = d.complementos?.anexos ?? {};
  return [
    { qtd: a.fichas ?? n, texto: "Ficha(s) Financeira(s)" },
    { qtd: a.folhasCalculo ?? n, texto: "Folha(s) de Cálculo(s)" },
    { qtd: a.recapitulacao ?? 1, texto: "Folha(s) de Cálculo-Recapitulação" },
    { qtd: a.comprovacao ?? 1, texto: "Comprovação Valores Recebidos e a Receber" },
    { qtd: a.bi ?? 1, texto: "Cópia do BI que concedeu o direito" },
  ];
}
export const requerente = (d: DadosDocumentos) => [d.militar.postoGraduacao, d.militar.nome].filter(Boolean).join(" ");


export const AZUL = "#1f5fbf";
export const VERMELHO = "#c00000";
export const corDoTipo = (t: TipoRubrica | string) => (t === "Receita" ? AZUL : t === "Despesa" ? VERMELHO : "#000");

export const e = StyleSheet.create({
  pagina: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 8.5, color: "#000" },
  centro: { textAlign: "center" },
  negrito: { fontFamily: "Helvetica-Bold" },
  titulo: { textAlign: "center", fontFamily: "Helvetica-Bold", textDecoration: "underline", fontSize: 9.5, marginVertical: 6 },
  linha: { flexDirection: "row" },
  celula: { borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: "#000", paddingVertical: 1.6, paddingHorizontal: 2.5 },
  tabela: { borderTopWidth: 0.6, borderLeftWidth: 0.6, borderColor: "#000" },
  rodape: { position: "absolute", bottom: 14, left: 36, right: 36, fontSize: 6, color: "#555", flexDirection: "row", justifyContent: "space-between" },
});

/** Cabeçalho institucional com brasão (igual ao das abas Solicitação, Recapitulação e Resumo). */
export function Cabecalho({ d, brasao = true }: { d: DadosDocumentos; brasao?: boolean }) {
  return (
    <View style={{ alignItems: "center", marginBottom: 6 }}>
      {brasao && <Image src={BRASAO_PNG} style={{ width: 46, height: 48, marginBottom: 3 }} />}
      <Text>MINISTÉRIO DA DEFESA</Text>
      <Text>EXÉRCITO BRASILEIRO</Text>
      {d.om.regiaoMilitar && <Text>{d.om.regiaoMilitar} - REGIÃO MILITAR</Text>}
      <Text>{d.om.nome.toUpperCase()}</Text>
    </View>
  );
}

export interface Coluna { largura: number | string; alinhar?: "left" | "center" | "right" }

/** Linha de tabela com bordas, a partir das larguras das colunas. */
export function Linha({ cols, valores, estilo, cores, altura, compacto }: {
  cols: Coluna[]; valores: ReactNode[]; estilo?: Style; cores?: (string | undefined)[]; altura?: number;
  /** linhas baixas (tabelas longas, como a Comprovação) */
  compacto?: boolean;
}) {
  return (
    <View style={[e.linha, altura ? { minHeight: altura } : {}]} wrap={false}>
      {cols.map((c, i) => (
        <View key={i} style={[e.celula, { width: c.largura, justifyContent: "center" }, compacto ? { paddingVertical: 0.5 } : {}]}>
          <Text style={[{ textAlign: c.alinhar ?? "left" }, cores?.[i] ? { color: cores[i] } : {}, estilo ?? {}]}>{valores[i] as string}</Text>
        </View>
      ))}
    </View>
  );
}

/** Assinaturas: cidade e data (opcional) e o Auxiliar Div Pg Pes que gerou o documento. */
export function Assinaturas({ d, data = true }: { d: DadosDocumentos; data?: boolean }) {
  return (
    <View style={{ marginTop: 18 }} wrap={false}>
      {data && <Text style={[e.centro, e.negrito, { marginBottom: 18 }]}>{[d.om.cidadeUf, d.processo.dataExtenso].filter(Boolean).join(", ")}</Text>}
      <View style={{ alignItems: "center" }}>
        <Text style={e.negrito}>{d.responsavel.nome ? d.responsavel.nome.toUpperCase() : "______________________________"}</Text>
        <Text>{d.responsavel.funcao}</Text>
      </View>
    </View>
  );
}

export function Rodape({ d, nome }: { d: DadosDocumentos; nome: string }) {
  return (
    <View style={e.rodape} fixed>
      <Text>{d.rodape}</Text>
      <Text render={({ pageNumber, totalPages }) => `${nome} · ${pageNumber}/${totalPages}`} />
    </View>
  );
}
