import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { ValoresMensais } from "@/components/ValoresMensais";
import { mesDeData } from "@/lib/lancamentos";
import { recebidosPosPeriodo } from "@/lib/pos-periodo";
import { carregarProcesso } from "@/lib/processo";
import { complSalMinAutomatico, ehRubricaGr, planoComplSalMin, VALOR_FIXADO } from "@/lib/compl-sal-min";
import { fichasLidasValidas } from "@/lib/receitas";
import { supabaseServidor } from "@/lib/supabase/server";
import { formatarReais } from "@/lib/dinheiro";

export async function PaginaValores({ id, tipo, proximaEtapa, importado }: {
  id: string; tipo: "recebido" | "devido"; proximaEtapa: string; importado?: boolean;
}) {
  const { processo, rubricas, lancamentos, bloqueado } = await carregarProcesso(id);
  if (!processo.periodo_inicio || !processo.periodo_fim) {
    return <Aviso tipo="atencao">Informe o período da dívida na etapa <Link href={`/processos/${id}/dados`} className="underline">Dados</Link>.</Aviso>;
  }
  // complemento de salário mínimo automático: observações dos meses com a gratificação de representação abatida
  const auto = complSalMinAutomatico(processo);
  // em "Lançar valor devido" do complemento, o campo da AR0061 não aparece (nada é devido nela)
  const rub = rubricas.filter((r) => !(auto && tipo === "devido" && ehRubricaGr(r.codigo)))
    .map(({ posicao, codigo, tipo }) => ({ posicao, codigo, tipo }));
  let notas: Record<string, string> = {};
  if (auto && tipo === "devido") {
    const { data } = await (await supabaseServidor()).from("processo").select("fichas_lidas").eq("id", id).maybeSingle();
    notas = planoComplSalMin(fichasLidasValidas(data?.fichas_lidas), processo.periodo_inicio, processo.periodo_fim).notas;
  }
  return (
    <div className="space-y-5">
      {importado && (
        <Aviso tipo="ok">Valores recebidos preenchidos pelos documentos enviados. Confira mês a mês abaixo.</Aviso>
      )}
      {auto && (
        <Aviso tipo="info">
          Complemento de salário mínimo: {tipo === "devido"
            ? `devidos preenchidos automaticamente com o valor fixado (${Object.entries(VALOR_FIXADO).map(([a, v]) => `R$ ${formatarReais(v)} em ${a}`).join(" e ")}), proporcional nos meses de início e fim incompletos. A AR0061 / GRAT REPRESENT EVENTUAL recebida (Receita) é descontada no cálculo; se ela for igual ou maior que o valor do mês, o mês não é computado.`
            : "AGA – COMPL SAL MIN e AR0061 / GRAT REPRESENT EVENTUAL preenchidos pelas fichas financeiras; o AGA recebido depois do período entra em “recebido após o período”."}
          {" "}Confira mês a mês; o que você digitar não é sobrescrito.
        </Aviso>
      )}
      {/* o envio de contracheque e fichas fica só em "Informações" (pedido do usuário) */}
      <ValoresMensais
        processoId={id} tipo={tipo} proximaEtapa={proximaEtapa} bloqueado={bloqueado} rubricas={rub}
        inicio={mesDeData(processo.periodo_inicio)} fim={mesDeData(processo.periodo_fim)}
        linhas={lancamentos.filter((l) => l.tipo === tipo).map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor }))}
        posPeriodo={tipo === "recebido" ? recebidosPosPeriodo(processo.complementos) : []}
        notas={notas}
      />
    </div>
  );
}
