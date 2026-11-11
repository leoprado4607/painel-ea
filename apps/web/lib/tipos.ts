import type { Complementos } from "@painel-ea/documentos";
import type { TipoRubrica } from "@painel-ea/engine";

export interface Om {
  id: string; nome: string; regiao_militar: string | null; unidade_gestora: string | null; codom: string | null;
  cidade_uf: string | null; ordenador_nome: string | null; ordenador_funcao: string | null; fiscal_nome: string | null;
  fiscal_funcao: string | null; chefe_pessoal_nome: string | null; chefe_pessoal_funcao: string | null;
}
export interface Perfil { usuario_id: string; om_id: string | null; papel: "operador" | "admin"; nome: string; posto: string | null; cpf: string | null; trocar_senha?: boolean }
export interface Militar {
  id: string; om_id: string; posto_graduacao: string | null; nome: string; prec_cp: string | null; identidade: string | null;
  cpf: string | null; banco: string | null; agencia: string | null; conta: string | null; situacao: string | null;
  om_vinculacao: string | null;
}
export interface Processo {
  id: string; om_id: string; militar_id: string; numero: string | null; ano: number | null; data_requerimento: string | null;
  bi_numero: string | null; bi_data: string | null;
  documento_averbacao: string | null; adt_numero: string | null; adt_boletim: string | null; om_averbacao: string | null; especie_divida: string | null; periodo_inicio: string | null;
  periodo_fim: string | null; data_solicitacao_extenso: string | null; possui_pensao_judicial: boolean;
  situacao: "rascunho" | "emitido" | "arquivado"; indice_ate: string | null; criado_em: string; atualizado_em: string;
  /** Quem criou: só ele (ou o Admin) altera, emite, reabre e exclui; os demais só consultam. */
  criado_por: string | null;
  complementos: Complementos | null;
}
export interface RubricaProcesso { processo_id: string; posicao: number; codigo: string; tipo: TipoRubrica }
export interface Lancamento { processo_id: string; tipo: "recebido" | "devido"; ano: number; mes: number; posicao: number; valor: number }

/** Função de quem assina os documentos (o operador logado). */
export const FUNCAO_RESPONSAVEL = "Auxiliar Div Pg Pes";

export const BANCOS = [
  "001 - Banco do Brasil", "033 - Santander", "041 - Banrisul", "070 - BRB", "104 - CEF",
  "237 - Bradesco", "341 - Itaú", "399 - HSBC", "745 - Citibank", "765 - Sicoob",
];
/** "1" ou "001" → "001 - Banco do Brasil" (lista do formulário); código fora da lista fica como veio, com 3 dígitos. */
export function bancoDaLista(codigo: string | null | undefined): string | undefined {
  const d = (codigo ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  const n = Number(d);
  return BANCOS.find((b) => Number(b.slice(0, 3)) === n) ?? d.padStart(3, "0");
}

/**
 * Valor da UFIR registrado na planilha original (Informações!B17): R$ 1,0641, o último antes da extinção da UFIR (2000).
 * Na planilha não entra em nenhuma fórmula de cálculo: só aparece no cabeçalho das comprovações (NN-Recebido/NN-Devido).
 */
export const VALOR_UFIR = 1.0641;

/**
 * OMs de vinculação e seus CODOM (tabela de 21/10/2026). Nome da OM e CODOM dos documentos são os da OM de
 * vinculação do militar, que nem sempre é a OM do operador e do Ordenador de Despesas.
 */
export const OMS_VINCULACAO = [
  { codom: "024406", nome: "Cmdo 7ª Bda Inf Mtz" },
  { codom: "003004", nome: "7º BE Cmb" },
  { codom: "001420", nome: "B Adm Gu Natal" },
  { codom: "065623", nome: "7º Pel PE" },
  { codom: "030007", nome: "Cia C/Cmdo 7ª Bda Inf Mtz" },
  { codom: "007807", nome: "16º BI Mtz" },
  { codom: "061200", nome: "HGuN" },
  { codom: "056507", nome: "17º GAC" },
  { codom: "032045", nome: "17ª Cia Com" },
].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));

/** "B ADM GU NATAL", "16 B I MTZ" → só letras e dígitos, sem acento nem º/ª, para comparar com a lista. */
const chaveOm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** OM da lista pelo CODOM (com ou sem zeros à esquerda) ou pelo nome escrito de outro jeito; fora da lista, undefined. */
export function omDeVinculacao(texto: string | null | undefined, codom?: string | null) {
  const d = (codom ?? "").replace(/\D/g, "");
  const porCodom = d ? OMS_VINCULACAO.find((o) => Number(o.codom) === Number(d)) : undefined;
  if (porCodom) return porCodom;
  const k = chaveOm(texto ?? "");
  return k ? OMS_VINCULACAO.find((o) => chaveOm(o.nome) === k) : undefined;
}

/**
 * Meses do período da dívida, contando inteiro o mês com pelo menos 1 dia no período
 * (15/01 a 02/03 → 3 meses). Datas "2025-01-15"; sem as duas datas ou com o fim antes do início, null.
 */
export function quantidadeMeses(inicio: string | null | undefined, fim: string | null | undefined): number | null {
  const a = /^(\d{4})-(\d{2})/.exec(inicio ?? ""), b = /^(\d{4})-(\d{2})/.exec(fim ?? "");
  if (!a || !b || fim! < inicio!) return null;
  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) + 1;
}

/** Espécies da dívida (lista definida em 21/10/2026), em ordem alfabética. */
export const ESPECIES_DIVIDA = [
  "Adicional Habilitação", "Adicional Natalino", "Adicional Permanência", "Auxílio fardamento", "Auxílio Funeral",
  "Auxílio Natalidade", "Auxílio pré-escolar", "Auxílio Transporte", "Compensação Orgânica", "Complemento de salário mínimo",
  "Férias / Indenização de férias", "Gratificação de Representação",
].sort((a, b) => a.localeCompare(b, "pt-BR"));
export const SITUACOES = ["Ativa", "Reintegrado", "Ex-Militar", "Veterano", "Reformado", "Pensionista"];
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
