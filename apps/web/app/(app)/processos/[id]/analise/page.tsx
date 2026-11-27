import { redirect } from "next/navigation";
import { PainelAnaliseAdicHab } from "@/components/PainelAnaliseAdicHab";
import { dadosAdicHab } from "@/lib/adic-hab";
import { analiseAdicHabPendente, analisarAdicHab, temAnaliseAdicHab, valorDaAnalise } from "@/lib/analise-adic-hab";
import { textoBoletim } from "@/lib/averbacao";
import { indicesDoProcesso } from "@/lib/indice";
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
  const a = analisarAdicHab({
    fichas: fichasLidasValidas(data?.fichas_lidas), inicio: processo.periodo_inicio, fim: processo.periodo_fim, dados: dadosAdicHab(processo.complementos),
    dataRequerimento: processo.data_requerimento, averbacao: textoBoletim(processo), hoje: new Date().toISOString().slice(0, 10), estender: pendente ? estender : false,
  });
  const { indices } = await indicesDoProcesso(supabase, processo);
  const valor = valorDaAnalise(a, indices);
  return <PainelAnaliseAdicHab processoId={id} a={a} valor={valor} estender={estender} pendente={pendente} />;
}
