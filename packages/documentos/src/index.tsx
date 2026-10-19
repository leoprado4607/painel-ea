/** Geração dos documentos do processo em PDF (mesmo conjunto e ordem das macros de impressão da planilha). */
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { anosDoPeriodo, type DadosDocumentos } from "./comum";
import { Comprovacao } from "./comprovacao";
import { Cpex } from "./cpex";
import { Recapitulacao } from "./recapitulacao";
import { Resumo } from "./resumo";
import { Solicitacao, SolicitacaoVerso } from "./solicitacao";
import { SolicitacaoPagamento, SolicitacaoPagamentoVerso } from "./solicitacao-pagamento";

export type { Complementos, DadosDocumentos } from "./comum";
export { PARECER_PADRAO, anexos } from "./comum";

/** Documento a gerar: o pacote completo ou uma parte dele (prévias das abas). */
export type TipoDocumento = "pacote_completo" | "solicitacao" | "cpex" | "recapitulacao" | "resumo" | "exercicio";

const paginasDoAno = (d: DadosDocumentos, ano: number) => [
  <Solicitacao key={`s${ano}`} d={d} ano={ano} />,
  <SolicitacaoVerso key={`v${ano}`} d={d} ano={ano} />,
  <Comprovacao key={`r${ano}`} d={d} ano={ano} tipo="recebido" />,
  <Comprovacao key={`d${ano}`} d={d} ano={ano} tipo="devido" />,
];

/**
 * Pacote completo: Solicitação de Pagamento e Verso; para cada ano do período, Solicitação, Verso,
 * Comprovação do Recebido e do Devido; depois Recapitulação, CPEX e Resumo.
 */
function Pacote({ d }: { d: DadosDocumentos }) {
  return (
    <Document title={`Exercício Anterior - ${d.militar.nome}`} author={d.om.nome} creator="Painel EA" producer="Painel EA">
      <SolicitacaoPagamento d={d} />
      <SolicitacaoPagamentoVerso d={d} />
      {anosDoPeriodo(d).flatMap((ano) => paginasDoAno(d, ano))}
      <Recapitulacao d={d} />
      <Cpex d={d} />
      <Resumo d={d} />
    </Document>
  );
}

/** Gera o PDF. "exercicio" pede o ano (as 4 folhas daquele ano). */
export async function gerarPdf(d: DadosDocumentos, tipo: TipoDocumento = "pacote_completo", ano?: number): Promise<Buffer> {
  const doc =
    tipo === "solicitacao" ? <Document><SolicitacaoPagamento d={d} /><SolicitacaoPagamentoVerso d={d} /></Document>
      : tipo === "cpex" ? <Document><Cpex d={d} /></Document>
        : tipo === "recapitulacao" ? <Document><Recapitulacao d={d} /></Document>
          : tipo === "resumo" ? <Document><Resumo d={d} /></Document>
            : tipo === "exercicio" ? <Document>{paginasDoAno(d, ano ?? anosDoPeriodo(d)[0]!)}</Document>
              : <Pacote d={d} />;
  return renderToBuffer(doc);
}
