import { notFound } from "next/navigation";
import { PainelAdicHab } from "@/components/PainelAdicHab";
import { planoAdicHab } from "@/lib/adic-hab";
import { PainelAnaliseAdicHab } from "@/components/PainelAnaliseAdicHab";
import { analisarAdicHab, valorDaAnalise } from "@/lib/analise-adic-hab";
import { PainelGratMensal } from "@/components/PainelGratMensal";
import { ESPECIE_GLE, planoGratMensal } from "@/lib/grat-mensal";
import { CardsNovoCalculo } from "@/components/CardsNovoCalculo";
import { NovoPorFichas } from "@/components/NovoPorFichas";
import { NovoPorProcesso } from "@/components/NovoPorProcesso";
import { AbaDocumento } from "@/components/AbaDocumento";
import { AbasProcesso } from "@/components/AbasProcesso";
import { DadosFavorecido } from "@/components/DadosFavorecido";
import { BarraLateral, ProvedorProcesso, RegistrarProcesso } from "@/components/BarraLateral";
import { FormularioProcesso } from "@/components/FormularioProcesso";
import { FormularioRubricas } from "@/components/FormularioRubricas";
import { ListaProcessos } from "@/components/ListaProcessos";
import { normalizarBusca } from "@/lib/busca";
import { ValoresMensais } from "@/components/ValoresMensais";
import { PainelGratRep } from "@/components/PainelGratRep";
import { planoGratRep, type DadosGratRep } from "@/lib/grat-rep";
import { PainelAuxFard } from "@/components/PainelAuxFard";
import { casoAuxFard, planoAuxFard, type DadosAuxFard } from "@/lib/aux-fard";

/** Prévia das telas com dados fictícios, para conferir o visual sem banco. Só existe em desenvolvimento. */
export default async function Previa({ searchParams }: { searchParams: Promise<{ tela?: string; tema?: string; caso?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela, tema, caso } = await searchParams;
  // ?tema=admin: tema escuro rústico do perfil Admin
  const rubricas = [
    { posicao: 1, codigo: "A01 - SOLDO", tipo: "Receita" as const },
    { posicao: 2, codigo: "A03 - ADIC HAB", tipo: "Receita" as const },
    { posicao: 6, codigo: "AD2 - ADICIONAL FÉRIAS", tipo: "Receita" as const },
    { posicao: 13, codigo: "Z01 - FUSEX", tipo: "Despesa" as const },
    { posicao: 14, codigo: "Z02 - P MIL 7,5/9,5/10,5%", tipo: "Despesa" as const },
  ];
  return (
    <div id="raiz-app" className={tema === "admin" ? "tema-escuro" : ""}>
      {tela === "abas" ? (
        <ProvedorProcesso>
        <div className="min-h-screen lg:flex">
          <BarraLateral admin escuro={tema === "admin"} usuario="Maj FULANO DE TAL" />
          <RegistrarProcesso id="00000000-0000-0000-0000-000000000000" situacao="rascunho"
            titulo="1º Sgt FULANO DE TAL DA SILVA" subtitulo="Processo 012/2026 · Diferença de adicional de habilitação" />
          <main className="min-w-0 flex-1 space-y-4 px-4 pb-10 pt-5 lg:px-8 lg:pt-8">
          <AbasProcesso id="00000000-0000-0000-0000-000000000000" situacao="rascunho"
            titulo="1º Sgt FULANO DE TAL DA SILVA" subtitulo="Processo 012/2026 · Diferença de adicional de habilitação" />
          <AbaDocumento processoId="00000000-0000-0000-0000-000000000000" doc="cpex" bloqueado={false} grupos={[
            { titulo: "Pensão judicial (ZED)", campos: [
              { nome: "possui_pensao_judicial", rotulo: "Possui pensão judicial no período da dívida", tipo: "checkbox", valor: true },
              { nome: "c.pensao.nome", rotulo: "Nome do beneficiário", valor: "Maria de Teste", largo: true },
              { nome: "c.pensao.cpf", rotulo: "CPF", placeholder: "000.000.000-00" },
            ] },
          ]} />
          </main>
        </div>
        </ProvedorProcesso>
      ) : <main className="mx-auto max-w-7xl px-4 py-6">{tela === "novo" ? (
        <div className="space-y-4"><h1 className="titulo-pagina">Novo cálculo</h1><p className="text-sm text-suave">Escolha o assunto do cálculo.</p><CardsNovoCalculo /></div>
      ) : tela === "novo-envio" ? (
        <div className="space-y-4"><h1 className="titulo-pagina">Novo cálculo: Auxílio-fardamento</h1><NovoPorProcesso especie="aux-fard" /><NovoPorFichas especie="aux-fard" /></div>
      ) : tela === "analise-adic-hab" ? (() => {
        // 2º Ten Mulatinho: majoração de 12% para 45% a contar de 03/08/2023 (?periodo=pedido: sem a extensão)
        const L = (codigo: string, meses: number[]) => ({ codigo, descricao: codigo, meses });
        const doze = (v: number) => Array(12).fill(v) as number[];
        const a = analisarAdicHab({ hoje: "2026-11-27", inicio: "2023-08-03", fim: "2023-12-31", dataRequerimento: "2025-05-29", averbacao: "BI 97 - HGuN, de 30/05/2025", estender: caso !== "pedido",
          dados: { tipo: "aperfeicoamento", curso: "Curso de Residência Médica em Dermatologia", documento: "BI nº 123, do HGuN, de 1º JUL 24", percentualPedido: 45 },
          fichas: [
            { ano: 2023, sistema: "sippes", linhas: [L("NR0001", [0, 0, 0, 0, 0, 0, 7315, 7315, 7315, 7315, 7315, 7315]), L("NR0003", [0, 0, 0, 0, 0, 0, 0, 0, 877.8, 877.8, 877.8, 877.8]),
              L("NR0014", [0, 0, 0, 0, 0, 0, 1389.85, 1389.85, 1389.85, 1389.85, 1389.85, 1389.85]), L("NR0085", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4974.2, 0]),
              L("NR0170", [0, 0, 0, 0, 0, 0, 365.75, 365.75, 365.75, 365.75, 365.75, 365.75]), L("AR0003", [0, 0, 0, 0, 0, 0, 0, 0, 0, 849.48, 0, 0])],
              descontos: [L("ND0001", [0, 0, 0, 0, 0, 0, 272.12, 272.12, 298.45, 298.45, 298.45, 298.45]), L("ND0039", [0, 0, 0, 0, 0, 0, 952.41, 952.41, 1044.58, 1044.58, 1044.58, 1044.58])] },
            { ano: 2024, sistema: "sippes", linhas: [L("NR0001", doze(7490)), L("NR0003", [898.8, 898.8, 898.8, 898.8, 898.8, 898.8, 898.8, 898.8, 3370.5, 3370.5, 3370.5, 3370.5]), L("NR0014", doze(1423.1)),
              L("NR0084", [0, 0, 0, 0, 0, 5093.2, 0, 0, 0, 0, 0, 0]), L("NR0085", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7564.9, 0]), L("NR0092", [0, 0, 0, 0, 3395.47, 0, 0, 0, 0, 0, 0, 0]),
              L("NR0170", doze(374.5)), L("AR0003", [0, 0, 0, 0, 0, 0, 0, 0, 17301.9, 0, 0, 0])] },
          ] });
        const pct = [0.53, 0.84, 0.71, 0.61, 0.23, -0.08, 0.12, 0.23, 0.26, 0.24, 0.28, 0.56, 0.42, 0.83, 0.16, 0.38, 0.46, 0.21, 0.38, -0.02, 0.44, 0.56, 0.39, 0.52,
          0.16, 1.31, 0.56, 0.43, 0.26, 0.24, 0.26, -0.11, 0.48, 0.18, 0.2, 0.25, 0.2, 0.84, 0.44, 0.89, 0.62, 0.41, 0.06, -0.4, 0.7, 0.32];
        const valor = valorDaAnalise(a, pct.map((p, i) => ({ ano: 2023 + Math.floor(i / 12), mes: (i % 12) + 1, percentual: p })));
        return <PainelAnaliseAdicHab processoId="previa" a={a} valor={valor} estender={caso !== "pedido"} pendente />;
      })() : tela === "adic-hab" ? (
        <PainelAdicHab processoId="previa" dados={{ tipo: "altos2", percentualPedido: 68, curso: "Curso de Gestão e Assessoramento de Estado-Maior – 3º Turno - 2025", documento: "Adt DCEM 4A ao Bol DGP nº 146, de 22 DEZ 25", mesesFerias: ["2025-12"] }}
          inicio="2025-12-12" fim="2025-12-31" bloqueado={false}
          plano={planoAdicHab({ fichas: [{ ano: 2025, sistema: "sippes", linhas: [
            { codigo: "NR0001", descricao: "SOLDO", meses: [11088, 11088, 11088, 11587, 11587, 11587, 11587, 11587, 11587, 11587, 11587, 11587] },
            { codigo: "NR0003", descricao: "ADICIONAL DE HABILITACAO", meses: [4989.6, 4989.6, 4989.6, 5214.15, 5214.15, 5214.15, 5214.15, 5214.15, 5214.15, 5214.15, 5214.15, 5214.15] },
            { codigo: "NR0092", descricao: "ADICIONAL DE FERIAS", meses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7911.19, 0] }] }],
            inicio: "2025-12-12", fim: "2025-12-31", hoje: "2026-11-25", dataRequerimento: "2026-02-19", averbacao: "BI 59 - Cmdo 7ª Bda Inf Mtz, de 31/03/2026",
            dados: { tipo: "altos2", percentualPedido: 68, curso: "Curso de Gestão e Assessoramento de Estado-Maior – 3º Turno - 2025", documento: "Adt DCEM 4A ao Bol DGP nº 146, de 22 DEZ 25", mesesFerias: ["2025-12"] } })} />
      ) : tela === "grat-mensal" ? (
        <PainelGratMensal processoId="previa" especie={ESPECIE_GLE} dados={{ local: "Boa Vista-RR", documento: "Adt nº 198 do EM Cj da Op CATRIMANI II, de 01/01/2026" }} inicio="2025-12-20" fim="2025-12-31" bloqueado={false}
          plano={planoGratMensal({ fichas: [{ ano: 2025, sistema: "sippes", linhas: [{ codigo: "NR0001", descricao: "SOLDO", meses: [6447, 6447, 6447, 6447, 6447, 6447, 6447, 6447, 6447, 6447, 6447, 6447] }] }],
            especie: ESPECIE_GLE, inicio: "2025-12-20", fim: "2025-12-31", hoje: "2026-11-25", dados: { local: "Boa Vista-RR", documento: "Adt nº 198 do EM Cj da Op CATRIMANI II, de 01/01/2026" } })} />
      ) : tela === "aux-fard" ? (
        // caso de teste 1 do prompt do Auxílio-fardamento (NUP 64241.005879/2026-73)
        (() => {
          const meses = (m: Record<number, number>) => Array.from({ length: 12 }, (_, i) => m[i + 1] ?? 0);
          const fichas = [
            { ano: 2021, sistema: "sippes" as const, linhas: [{ codigo: "NR0001", descricao: "SOLDO", meses: meses({ 7: 7315, 12: 7315 }) }, { codigo: "NR0056", descricao: "AUXILIO FARDAMENTO 1 SOLDO", meses: meses({ 7: 7315 }) }] },
            { ano: 2022, sistema: "sippes" as const, linhas: [{ codigo: "NR0001", descricao: "SOLDO", meses: meses({ 1: 7490 }) }, { codigo: "NR0056", descricao: "AUXILIO FARDAMENTO 1 SOLDO", meses: meses({ 1: 175 }) }] },
          ];
          // ?caso=promocao | trienio | mesma_data: os outros casos com as mesmas fichas
          const dados: DadosAuxFard = { caso: casoAuxFard(caso), fato1: { tipo: "aspirante", data: "2021-07-12", categoria: "asp" }, fato2: { tipo: "promocao", data: "2021-12-25", categoria: "2-ten" } };
          const entrada = { fichas, dataRequerimento: "2026-09-28", periodoInicio: "2021-12-01", averbacao: "BI 210 - HGuJP, de 05/10/2026", hoje: "2026-11-24" };
          return <PainelAuxFard processoId="previa" dados={dados} bloqueado={false} entrada={entrada} plano={planoAuxFard({ ...entrada, dados })} />;
        })()
      ) : tela === "grat-rep" ? (
        // caso 1 do prompt da Grat Rep (NUP 64552.003413/2025-49)
        (() => {
          const meses = (m: Record<number, number>) => Array.from({ length: 12 }, (_, i) => m[i + 1] ?? 0);
          const fichas = [
            { ano: 2023, sistema: "sippes" as const, linhas: [{ codigo: "NR0001", descricao: "SOLDO", meses: meses({ 8: 2627, 9: 2627 }) }, { codigo: "AR0061", descricao: "GRAT REPRESENT EVENTUAL", meses: meses({ 12: 420.32 }) }] },
            { ano: 2025, sistema: "sippes" as const, linhas: [{ codigo: "AR0061", descricao: "GRAT REPRESENT EVENTUAL", meses: meses({ 1: 472.86 }) }] },
          ];
          const dados: DadosGratRep = { horaSaida: "12:00", horaRetorno: "09:00", autorizacao: { documento: "Adt Nr 12 ao BI Nr 61 do CMNE, de 05/03/2024", publicacao: "2024-03-05", dias: 8, valor: 420.32 } };
          return <PainelGratRep processoId="previa" dados={dados} inicio="2023-08-26" fim="2023-09-03" bloqueado={false}
            plano={planoGratRep({ fichas, inicio: "2023-08-26", fim: "2023-09-03", dados, hoje: "2026-11-23" })} />;
        })()
      ) : tela === "aviso" ? (
        <DadosFavorecido processoId="previa" valores={{}} rubricas={[]} bloqueado={false} conferirBanco />
      ) : tela === "recebidos" ? (
        <ValoresMensais processoId="previa" tipo="recebido" proximaEtapa="devidos" bloqueado={false} rubricas={rubricas}
          inicio={{ ano: 2020, mes: 11 }} fim={{ ano: 2021, mes: 6 }} linhas={[]}
          posPeriodo={[{ ano: 2022, mes: 3, posicao: 1, valor: 1000 }]} />
      ) : tela === "valores" ? (
        <ValoresMensais processoId="previa" tipo="devido" proximaEtapa="conferencia" bloqueado={false} rubricas={rubricas}
          inicio={{ ano: 2020, mes: 11 }} fim={{ ano: 2021, mes: 6 }}
          linhas={[{ ano: 2020, mes: 11, posicao: 1, valor: 5500 }, { ano: 2020, mes: 11, posicao: 13, valor: 165 }]} />
      ) : tela === "processos" ? (
        <ListaProcessos cards={[
          { id: "a", nome: "1º Sgt SANDRO LUIS DE LIMA GONCALVES", nomeCompleto: "SANDRO LUIS DE LIMA GONCALVES", om: "16º BI Mtz", periodo: "06/2021 a 06/2021", especie: "Auxílio fardamento",
            valor: "R$ 6.389,41", valorNumero: 6389.41, situacao: "emitido", meu: true, descricao: "001 de 1º Sgt SANDRO", operador: "Cb Bruno Guilherme de Souza Bezerra", busca: normalizarBusca("1º Sgt SANDRO LUIS DE LIMA GONCALVES PRIMEIRO SARGENTO 16º BI Mtz Auxílio fardamento") },
          { id: "c", nome: "2º Sgt SANDRO LUÍS DE LIMA GONÇALVES", nomeCompleto: "SANDRO LUÍS DE LIMA GONÇALVES", om: "16º BI Mtz", periodo: "01/2020 a 12/2020", especie: "Adicional Habilitação",
            valor: "R$ 2.000,00", valorNumero: 2000, situacao: "rascunho", meu: false, descricao: "003 de 2º Sgt SANDRO", busca: normalizarBusca("2º Sgt SANDRO LUÍS DE LIMA GONÇALVES 16º BI Mtz Adicional Habilitação") },
          { id: "b", nome: "Cb FULANO DE TAL", nomeCompleto: "FULANO DE TAL", om: "B Adm Gu Natal", periodo: "01/2024 a 12/2024", especie: "Adicional Habilitação",
            valor: "R$ 1.234,56", valorNumero: 1234.56, situacao: "rascunho", meu: false, descricao: "002 de Cb FULANO", busca: normalizarBusca("Cb FULANO DE TAL B Adm Gu Natal Adicional Habilitação") },
        ]} />
      ) : tela === "rubricas" ? (
        <FormularioRubricas processoId="previa" bloqueado={false} rubricas={Array.from({ length: 17 }, (_, i) => ({
          posicao: i + 1, codigo: i >= 12 ? rubricas.find((r) => r.posicao === i + 1)?.codigo ?? "" : "", tipo: i < 12 ? "Receita" as const : "Despesa" as const,
        }))} />
      ) : (
        <FormularioProcesso processoId={null} documentosRecentes={["BI Nº 045, de 10 mar 2022, do 16º BI Mtz", "<b>Aditamento</b> Nº 12 ao BI Nº 100, de 02 jun 2022", "BAR Nº 008, de 15 ago 2023", "BI Nº 201, de 30 out 2023", "Portaria Nº 77, de 05 jan 2024", "BI Nº 019, de 28 jan 2025"]} />
      )}</main>}
    </div>
  );
}
