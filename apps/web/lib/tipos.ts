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
  documento_averbacao: string | null; adt_numero: string | null; om_averbacao: string | null; especie_divida: string | null; periodo_inicio: string | null;
  periodo_fim: string | null; data_solicitacao_extenso: string | null; possui_pensao_judicial: boolean;
  situacao: "rascunho" | "emitido" | "arquivado"; indice_ate: string | null; criado_em: string; atualizado_em: string;
  complementos: Complementos | null;
}
export interface RubricaProcesso { processo_id: string; posicao: number; codigo: string; tipo: TipoRubrica }
export interface Lancamento { processo_id: string; tipo: "recebido" | "devido"; ano: number; mes: number; posicao: number; valor: number }

/** Função de quem assina os documentos (o operador logado). */
export const FUNCAO_RESPONSAVEL = "Auxiliar Div Pg Pes";

export const BANCOS = ["001 - Brasil", "033 - Santander", "041 - Banrisul", "070 - BRB", "104 - CEF", "237 - Bradesco", "341 - Itaú"];
export const SITUACOES = ["Ativa", "Reintegrado", "Ex-Militar", "Veterano", "Reformado", "Pensionista"];
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
