/** "NN-Recebido" / "NN-Devido": comprovação mês a mês, com o índice acumulado e o valor corrigido de cada mês. */
import { Page, Text, View } from "@react-pdf/renderer";
import { Assinaturas, e, Linha, MESES, pct, requerente, Rodape, traco, type Coluna, type DadosDocumentos } from "./comum";

export function Comprovacao({ d, ano, tipo }: { d: DadosDocumentos; ano: number; tipo: "recebido" | "devido" }) {
  const a = d.resultado.porAno[ano]!;
  const bruto = tipo === "recebido" ? a.recebido : a.devido;
  const corrigido = tipo === "recebido" ? a.recebidoCorrigido : a.devidoCorrigido;
  const titulo = tipo === "recebido" ? "Comprovação dos Valores Recebidos em" : "Comprovação dos Valores Devidos em";
  const cols: Coluna[] = [{ largura: "19%" }, ...Array.from({ length: 6 }, () => ({ largura: "13.5%", alinhar: "right" as const }))];
  return (
    <Page size="A4" style={[e.pagina, { fontSize: 6, paddingHorizontal: 24, paddingTop: 20 }]}>
      <Text style={[e.centro, e.negrito, { fontSize: 11, marginBottom: 3 }]}>{titulo} {ano}</Text>
      <View style={[e.linha, { justifyContent: "space-between", marginBottom: 4 }]}>
        <Text>Nome do Requerente: {requerente(d)}</Text>
        {/* como na planilha (J4/K4 das abas NN-Recebido/NN-Devido): o valor da UFIR ao lado do índice */}
        <Text>
          {d.valorUfir ? `UFIR: ${d.valorUfir.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}    ` : ""}
          Corrigido pela série {d.descricaoIndice}, atualizada até {d.indiceAte}
        </Text>
      </View>
      {[0, 1, 2, 3].map((g) => (
        <View key={g} style={[e.tabela, { marginBottom: 4 }]} wrap={false}>
          <Linha compacto cols={cols} estilo={e.negrito}
            valores={["ESPECIFICAÇÃO", ...[0, 1, 2].flatMap((k) => {
              const m = 3 * g + k;
              return [`${MESES[m]}/${ano}`, `corrigido ${pct(a.acumuladoMes[m]!)}`];
            })]} />
          {d.rubricas.map((r, p) => (
            <Linha compacto key={p} cols={cols}
              valores={[r.codigo, ...[0, 1, 2].flatMap((k) => {
                const m = 3 * g + k;
                return [traco(bruto[p]![m]!), traco(corrigido[p]![m]!)];
              })]} />
          ))}
        </View>
      ))}
      <View style={{ marginTop: -8 }}><Assinaturas d={d} data={false} /></View>
      <Rodape d={d} nome={`${ano}-${tipo === "recebido" ? "Recebido" : "Devido"}`} />
    </Page>
  );
}
