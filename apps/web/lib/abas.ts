/**
 * Abas do rodapé, na ordem das abas da planilha original. A cor da aba (como no Excel) indica o grupo:
 * sistema (cinza), lançamentos do processo (verde) e documentos do processo (latão).
 */
export type GrupoAba = "sistema" | "lancamento" | "documento";

export interface Aba {
  rotulo: string;
  grupo: GrupoAba;
  /** Caminho global ("/om") ou, para abas do processo, o trecho depois de /processos/<id>/ ("dados"). */
  caminho: string;
  doProcesso: boolean;
  soAdmin?: boolean;
}

export const ABAS: Aba[] = [
  { rotulo: "Passo a passo", grupo: "sistema", caminho: "/passo-a-passo", doProcesso: false },
  { rotulo: "Atualização do IPCA-E", grupo: "sistema", caminho: "/ipca", doProcesso: false },
  { rotulo: "Dados da OM", grupo: "sistema", caminho: "/om", doProcesso: false },
  { rotulo: "Operadores", grupo: "sistema", caminho: "/operadores", doProcesso: false, soAdmin: true },
  { rotulo: "Informações", grupo: "lancamento", caminho: "dados", doProcesso: true },
  { rotulo: "Códigos lançamento", grupo: "lancamento", caminho: "rubricas", doProcesso: true },
  { rotulo: "Contracheque - F Financeira", grupo: "lancamento", caminho: "recebidos", doProcesso: true },
  { rotulo: "Lançar valor devido", grupo: "lancamento", caminho: "devidos", doProcesso: true },
  { rotulo: "Solicitação", grupo: "documento", caminho: "solicitacao", doProcesso: true },
  { rotulo: "Solicitação verso", grupo: "documento", caminho: "solicitacao-verso", doProcesso: true },
  { rotulo: "CPEX", grupo: "documento", caminho: "cpex", doProcesso: true },
  { rotulo: "Recapitulação", grupo: "documento", caminho: "recapitulacao", doProcesso: true },
  { rotulo: "Impressão", grupo: "documento", caminho: "conferencia", doProcesso: true },
  { rotulo: "Resumo", grupo: "documento", caminho: "resumo", doProcesso: true },
  { rotulo: "Exercícios por ano", grupo: "documento", caminho: "exercicios", doProcesso: true },
];

/** Endereço da aba: global, do processo informado ou, sem processo, a lista de processos. */
export function enderecoAba(aba: Aba, processoId: string | null): string | null {
  if (!aba.doProcesso) return aba.caminho;
  return processoId ? `/processos/${processoId}/${aba.caminho}` : null;
}

/** Aba ativa a partir do endereço atual. */
export function abaAtiva(caminho: string): Aba | undefined {
  const m = caminho.match(/^\/processos\/[^/]+\/([^/?]+)/);
  if (m) return ABAS.find((a) => a.doProcesso && a.caminho === m[1]);
  return ABAS.find((a) => !a.doProcesso && (caminho === a.caminho || caminho.startsWith(`${a.caminho}/`)));
}

/** Id do processo no endereço (/processos/<id>/...), ignorando /processos/novo. */
export function processoDoCaminho(caminho: string): string | null {
  const m = caminho.match(/^\/processos\/([0-9a-f-]{36})(?:\/|$)/);
  return m ? m[1]! : null;
}
