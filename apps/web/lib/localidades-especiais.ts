/**
 * Categoria da localidade especial pela Portaria GM-MD nº 379/2022 (em vigor desde 02/03/2022): arts. 3º e 4º (pelas
 * linhas Alfa e Beta, que seguem limites entre estados) e Anexo II (Tabela I: também "A"; Tabela II: também "B";
 * Tabela III: excluídas). Só SUGERE: o operador escolhe no quadro. Não cobre as áreas marítimas nem as vias fluviais.
 */
import { normalizar } from "./processo-completo";

/** A oeste da linha Alfa (art. 3º). */
const UF_A = new Set(["AC", "AM", "AP", "PA", "RO", "RR", "TO", "MT", "MS"]);
/** A leste da Alfa e ao norte da Beta (BA-ES, BA-MG, GO-MG) (art. 4º). DF: excluído pela Tabela III. */
const UF_B = new Set(["MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA", "GO"]);

const TABELA_I: Record<string, string[]> = {
  BA: ["Arquipélago de Abrolhos", "Caravelas"], ES: ["Ilha de Trindade"], GO: ["Aragarças", "Porangatu"],
  MA: ["Farol Preguiças", "Farol Araçagy", "Farol Santana", "Farol São João", "Alcântara"], MS: ["Aquidauana"],
  PE: ["Fernando de Noronha"], PR: ["Guaíra", "Radiofarol Paranaguá"],
  RJ: ["Ilha Rasa", "Farol de Macaé", "Farol de Cabo Frio", "Farol de Castelhanos", "Radiofarol de São Tomé"],
  RN: ["Radiofarol de Calcanhar", "Farol da Ponta do Mel"],
  RS: ["Rio Grande", "Tramandaí", "Cidreira", "Chuí", "Farol Mostardas", "Farol Albardão", "São José do Norte"],
  SC: ["Farol de Santa Marta", "Ilha da Paz", "Ilha do Arvoredo", "Urubici"], SP: ["Ilha da Moela", "Farol da Ponta do Boi"],
};
const TABELA_II: Record<string, string[]> = {
  ES: ["São Gabriel da Palha", "Santa Teresa"],
  MG: ["Pirapora", "Januária", "Jequitinhonha", "Araçuaí", "Nanuque", "São Gonçalo do Abaeté", "Caeté", "Três Marias", "Montes Claros", "Janaúba"],
  MS: ["Dourados"], MT: ["Cuiabá", "Rondonópolis", "Várzea Grande"],
  PR: ["Foz do Iguaçu", "Palmas", "Catanduvas", "Cascavel", "Francisco Beltrão", "Umuarama", "Assis Chateaubriand", "Medianeira", "Pato Branco"],
  RJ: ["Parati", "Paraty", "Marambaia"],
  RS: ["Uruguaiana", "Santiago", "Itaqui", "Jaguarão", "Quaraí", "Alegrete", "São Borja", "São Luiz Gonzaga", "Bagé", "Santana do Livramento",
    "Canguçu", "Dom Pedrito", "Rosário do Sul", "Santo Ângelo", "Santa Rosa", "Frederico Westphalen", "Sarandi", "Butiá", "General Câmara"],
  SC: ["Laguna", "São Miguel do Oeste", "Xanxerê", "Chapecó", "Maravilha", "Três Barras"], SP: ["Vicente de Carvalho", "Tanabi", "São Roque"],
};
const TABELA_III: Record<string, string[]> = {
  AL: ["Maceió", "Rio Largo"], BA: ["Salvador", "Ilhéus", "Feira de Santana", "Itabuna", "Camaçari", "Vitória da Conquista", "Jequié"],
  CE: ["Fortaleza"], DF: ["Brasília"], GO: ["Goiânia", "Anápolis"], MS: ["Campo Grande"], PB: ["João Pessoa", "Bayeux", "Campina Grande"],
  PE: ["Recife", "Olinda", "Jaboatão dos Guararapes"], RN: ["Natal", "Parnamirim"], SE: ["Aracaju"],
};

const cidadeNa = (tabela: Record<string, string[]>, uf: string, cidade: string) =>
  (tabela[uf] ?? []).some((c) => cidade.includes(normalizar(c)));

/** "Boa Vista-RR", "Campina Grande - PB", "Manaus/AM": categoria sugerida e o motivo. Sem UF reconhecível, null. */
export function sugerirLocalidade(local: string | null | undefined): { categoria: "A" | "B" | null; motivo: string } | null {
  const t = normalizar(local ?? "");
  const m = /^(.*?)[\s\-/,]+([A-Z]{2})$/.exec(t);
  if (!m) return null;
  const cidade = m[1]!.trim(), uf = m[2]!;
  if (DF_OU_UF(uf) === null) return null;
  if (cidadeNa(TABELA_III, uf, cidade)) {
    const extra = uf === "RN" ? " (salvo a área delimitada da Tabela III, em Parnamirim)" : "";
    return { categoria: null, motivo: `${local} está na Tabela III do Anexo II: excluída da classificação de localidade especial${extra}.` };
  }
  if (cidadeNa(TABELA_I, uf, cidade)) return { categoria: "A", motivo: `${local} está na Tabela I do Anexo II (categoria A).` };
  if (cidadeNa(TABELA_II, uf, cidade)) return { categoria: "B", motivo: `${local} está na Tabela II do Anexo II (categoria B).` };
  if (UF_A.has(uf)) return { categoria: "A", motivo: `${uf} fica a oeste da linha Alfa (art. 3º): categoria A.` };
  if (UF_B.has(uf)) return { categoria: "B", motivo: `${uf} fica entre as linhas Alfa e Beta (art. 4º): categoria B.` };
  return { categoria: null, motivo: `${uf} fica ao sul da linha Beta e ${local} não está nas tabelas do Anexo II: não é localidade especial.` };
}
const UFS = new Set(["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]);
const DF_OU_UF = (uf: string) => (UFS.has(uf) ? uf : null);
