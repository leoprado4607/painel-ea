import { redirect } from "next/navigation";
import { PainelAnaliseAdicHab } from "@/components/PainelAnaliseAdicHab";
import { dadosAdicHab } from "@/lib/adic-hab";
import { analiseAdicHabPendente, analisarAdicHab, temAnaliseAdicHab, valorDaAnalise } from "@/lib/analise-adic-hab";
import { textoBoletim } from "@/lib/averbacao";
import { indicesDoProcesso } from "@/lib/indice";
import { valoresDaFicha } from "@/lib/ficha-digitada";
import { carregarProcesso } from "@/lib/processo";
import { fichasLidasValidas } from "@/lib/receitas";

/**
 * Análise do Adicional de Habilitação (27/11/2026): aberta logo depois de "Ler o processo e iniciar" nos processos novos
 * dessa espécie. Os processos sem o marcador (os cadastrados antes) vão direto para as Informações.
 */
export default async function Analise({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periodo?: string }> }) {
  const { id } = await params;
  const { periodo } = await searchParams;
  const { supabase, processo, bloqueado } = await carregarProcesso(id);
  if (!temAnaliseAdicHab(processo)) redirect(`/processos/${id}/dados`);
  const pendente = analiseAdicHabPendente(processo) && !bloqueado;
  const { data } = await supabase.from("processo").select("fichas_lidas").eq("id", id).single();
  const estender = periodo !== "pedido";
  const fichas = fichasLidasValidas(data?.fichas_lidas);
  const dados = dadosAdicHab(processo.complementos);
  const hoje = new Date().toISOString().slice(0, 10);
  const a = analisarAdicHab({
    fichas, inicio: processo.periodo_inicio, fim: processo.periodo_fim, dados,
    dataRequerimento: processo.data_requerimento, averbacao: textoBoletim(processo), hoje, estender: pendente ? estender : false,
  });
  const { indices } = await indicesDoProcesso(supabase, processo);
  const valor = valorDaAnalise(a, indices);
  // entrada manual: os anos do período e o seguinte (até o ano corrente); sem início, os últimos 8 anos
  const anoAtual = +hoje.slice(0, 4);
  const a0 = processo.periodo_inicio ? +processo.periodo_inicio.slice(0, 4) : anoAtual - 7;
  const a1 = Math.min(anoAtual, (processo.periodo_fim ? +processo.periodo_fim.slice(0, 4) : a.fim ? +a.fim.slice(0, 4) : anoAtual - 1) + 1);
  const anos = [...new Set([...Array.from({ length: Math.max(1, a1 - a0 + 1) }, (_, i) => a0 + i), ...fichas.map((f) => f.ano)])].sort((x, y) => x - y);
  const manual = {
    direito: {
      inicio: processo.periodo_inicio ?? "", fim: processo.periodo_fim ?? "", dataRequerimento: processo.data_requerimento ?? "",
      tipo: dados.tipo ?? "", curso: dados.curso ?? "", documento: dados.documento ?? "",
      percentualPedido: dados.percentualPedido ? String(dados.percentualPedido).replace(".", ",") : "",
    },
    anos, fichas: fichas.map(valoresDaFicha),
  };
  return <PainelAnaliseAdicHab processoId={id} a={a} valor={valor} estender={estender} pendente={pendente} manual={manual} />;
}
