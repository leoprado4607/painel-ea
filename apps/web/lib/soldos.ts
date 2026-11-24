/**
 * Soldos do Exército, 2018 a 2026 (tabela enviada pelo usuário em 23/11/2026): Lei nº 13.321/2016 (Anexo I, 2018 e 2019),
 * Lei nº 13.954/2019 (Anexo VI, jan/2020 a mar/2025) e Lei nº 15.167/2025 (abr/2025 e jan/2026).
 * Valores mensais nominais. Usada no cálculo automático da Gratificação de Representação (lib/grat-rep): soldo do posto
 * ou graduação NA DATA DO FATO, na vigência do dia de início. Novo reajuste: acrescente a vigência e uma coluna em cada linha.
 */

/** Início de cada vigência ("AAAA-MM-DD"), na ordem; cada linha de SOLDOS tem um valor por vigência. */
export const VIGENCIAS_SOLDO = ["2018-01-01", "2019-01-01", "2020-01-01", "2025-04-01", "2026-01-01"] as const;

export interface CategoriaSoldo { id: string; nome: string; valores: readonly number[] }

/** Postos e graduações do Exército, na ordem hierárquica. */
export const SOLDOS: readonly CategoriaSoldo[] = [
  { id: "gen-ex", nome: "General de Exército", valores: [12763, 13471, 13471, 14077, 14711] },
  { id: "gen-div", nome: "General de Divisão", valores: [12233, 12912, 12912, 13493, 14100] },
  { id: "gen-bda", nome: "General de Brigada", valores: [11833, 12490, 12490, 13052, 13639] },
  { id: "cel", nome: "Coronel", valores: [10832, 11451, 11451, 11966, 12505] },
  { id: "ten-cel", nome: "Tenente-Coronel", valores: [10642, 11250, 11250, 11756, 12285] },
  { id: "maj", nome: "Major", valores: [10472, 11088, 11088, 11587, 12108] },
  { id: "cap", nome: "Capitão", valores: [8517, 9135, 9135, 9546, 9976] },
  { id: "1-ten", nome: "Primeiro-Tenente", valores: [7796, 8245, 8245, 8616, 9004] },
  { id: "2-ten", nome: "Segundo-Tenente", valores: [7082, 7490, 7490, 7827, 8179] },
  { id: "asp", nome: "Aspirante a Oficial", valores: [6625, 6993, 7315, 7644, 7988] },
  { id: "cadete-ime-ult", nome: "Cadete / aluno do IME (último ano)", valores: [1372, 1448, 1630, 1703, 1780] },
  { id: "cadete", nome: "Cadete (demais anos) / aluno de OFOR", valores: [1114, 1176, 1334, 1394, 1457] },
  { id: "aluno-sgt-ult", nome: "Aluno de escola de formação de sargentos / preparatória (último ano)", valores: [1010, 1066, 1199, 1253, 1309] },
  { id: "aluno-prep", nome: "Aluno de escola preparatória (demais anos)", valores: [989, 1044, 1185, 1238, 1294] },
  { id: "s-ten", nome: "Subtenente", valores: [5751, 6169, 6169, 6447, 6737] },
  { id: "1-sgt", nome: "Primeiro-Sargento", valores: [5110, 5483, 5483, 5730, 5988] },
  { id: "2-sgt", nome: "Segundo-Sargento", valores: [4445, 4770, 4770, 4985, 5209] },
  { id: "3-sgt", nome: "Terceiro-Sargento", valores: [3584, 3825, 3825, 3997, 4177] },
  { id: "cb-eng", nome: "Cabo (engajado) – Cb EP", valores: [2449, 2627, 2627, 2745, 2869] },
  { id: "cb-ne", nome: "Cabo (não engajado)", valores: [886, 956, 1078, 1127, 1177] },
  { id: "sd-pqdt", nome: "Soldado paraquedista (engajado) / Clarim-Corneteiro de 1ª classe", valores: [1758, 1856, 1926, 2013, 2103] },
  { id: "sd-ep", nome: "Soldado engajado – Sd EP / Clarim-Corneteiro de 2ª classe", valores: [1478, 1560, 1765, 1844, 1927] },
  { id: "sd-ev", nome: "Soldado recruta – Sd EV (efetivo variável) / Clarim-Corneteiro de 3ª classe", valores: [854, 956, 1078, 1127, 1177] },
];

export const categoriaSoldo = (id: string | null | undefined) => SOLDOS.find((c) => c.id === id);

/** Índice da vigência do dia ("AAAA-MM-DD"); antes de 2018, -1. */
const vigencia = (data: string) => {
  let i = -1;
  VIGENCIAS_SOLDO.forEach((v, k) => { if (data >= v) i = k; });
  return i;
};

/** Soldo da categoria no dia; sem tabela para a data ou categoria desconhecida, null. */
export function soldoNaData(id: string | null | undefined, data: string): number | null {
  const c = categoriaSoldo(id), i = vigencia(data);
  return c && i >= 0 ? c.valores[i]! : null;
}

/** Categorias com esse soldo no dia (para sugerir a graduação a partir da NR0001 da ficha). */
export function categoriasComSoldo(valor: number, data: string): CategoriaSoldo[] {
  const i = vigencia(data);
  return i < 0 ? [] : SOLDOS.filter((c) => c.valores[i] === valor);
}
