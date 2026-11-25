import { ESPECIE_AUX_FARD } from "@/lib/aux-fard";
import { ESPECIE_COMPL_SAL_MIN } from "@/lib/compl-sal-min";
import { ESPECIE_GLE, ESPECIE_GR_CMDO } from "@/lib/grat-mensal";
import { ESPECIE_GRAT_REP } from "@/lib/grat-rep";

/** Cards da tela "Novo cálculo": as espécies com cálculo automático têm acesso direto; o resto vai para "Demais assuntos". */
export const CARDS_NOVO_CALCULO = [
  { id: "compl-sal-min", titulo: "Complemento de salário mínimo", especie: ESPECIE_COMPL_SAL_MIN, automatico: true,
    resumo: "Meses em que a remuneração ficou abaixo do salário mínimo." },
  { id: "grat-rep", titulo: "Gratificação de Representação Eventual", especie: ESPECIE_GRAT_REP, automatico: true,
    resumo: "2% do soldo por dia de evento não pago na época." },
  { id: "aux-fard", titulo: "Auxílio-fardamento", especie: ESPECIE_AUX_FARD, automatico: true,
    resumo: "Diferença devida pelo 2º fato gerador (art. 61 ou mesma data)." },
  { id: "grat-loc", titulo: "Gratificação de Localidade Especial", especie: ESPECIE_GLE, automatico: true,
    resumo: "20% (A) ou 10% (B) do soldo por mês na localidade especial." },
  { id: "grat-cmdo", titulo: "Gratificação de Representação de Comando", especie: ESPECIE_GR_CMDO, automatico: true,
    resumo: "10% do soldo por mês no cargo de comando, direção ou chefia." },
  { id: "demais", titulo: "Demais assuntos", especie: null, automatico: false,
    resumo: "Outras espécies: valores devidos lançados pelo operador." },
] as const;

export type CardNovoCalculo = (typeof CARDS_NOVO_CALCULO)[number];

export const cardNovoCalculo = (id: string | undefined | null): CardNovoCalculo | undefined =>
  CARDS_NOVO_CALCULO.find((c) => c.id === id);
