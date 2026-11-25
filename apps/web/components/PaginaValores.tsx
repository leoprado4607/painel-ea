import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { ValoresMensais } from "@/components/ValoresMensais";
import { mesDeData } from "@/lib/lancamentos";
import { recebidosPosPeriodo } from "@/lib/pos-periodo";
import { carregarProcesso } from "@/lib/processo";
import { complSalMinAutomatico, ehRubricaGr, planoComplSalMin, VALOR_FIXADO } from "@/lib/compl-sal-min";
import { dadosGratRep, gratRepAutomatico, planoGratRep } from "@/lib/grat-rep";
import { PainelGratRep } from "@/components/PainelGratRep";
import { PainelAuxFard } from "@/components/PainelAuxFard";
import { PainelGratMensal } from "@/components/PainelGratMensal";
import { dadosGratMensal, gratMensalAutomatico, planoGratMensal } from "@/lib/grat-mensal";
import { leituraGuardada } from "@/lib/processo-completo";
import { auxFardAutomatico, dadosAuxFard, planoAuxFard } from "@/lib/aux-fard";
import { textoBoletim } from "@/lib/averbacao";
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
  // Gratificação de Representação automática: quadro do evento e cálculo em "Lançar valor devido"
  const autoGr = gratRepAutomatico(processo);
  const dadosGr = dadosGratRep(processo.complementos);
  let planoGr = null;
  if (autoGr && tipo === "devido") {
    const { data } = await (await supabaseServidor()).from("processo").select("fichas_lidas").eq("id", id).maybeSingle();
    planoGr = planoGratRep({
      fichas: fichasLidasValidas(data?.fichas_lidas), inicio: processo.periodo_inicio, fim: processo.periodo_fim, dados: dadosGr,
      dataRequerimento: processo.data_requerimento, hoje: new Date().toISOString().slice(0, 10),
    });
    notas = planoGr.notas;
  }
  // Auxílio-fardamento automático: quadro dos fatos geradores e cálculo em "Lançar valor devido"
  const autoAf = auxFardAutomatico(processo);
  const dadosAf = dadosAuxFard(processo.complementos);
  let planoAf = null;
  if (autoAf && tipo === "devido") {
    const { data } = await (await supabaseServidor()).from("processo").select("fichas_lidas").eq("id", id).maybeSingle();
    planoAf = planoAuxFard({
      fichas: fichasLidasValidas(data?.fichas_lidas), dados: dadosAf, dataRequerimento: processo.data_requerimento,
      periodoInicio: processo.periodo_inicio, averbacao: textoBoletim(processo), hoje: new Date().toISOString().slice(0, 10),
    });
    notas = planoAf.notas;
  }
  // gratificações mensais automáticas (localidade especial e comando): quadro e cálculo em "Lançar valor devido"
  const autoGm = gratMensalAutomatico(processo);
  const dadosGm = dadosGratMensal(processo.complementos);
  let planoGm = null;
  if (autoGm && tipo === "devido") {
    const { data } = await (await supabaseServidor()).from("processo").select("fichas_lidas").eq("id", id).maybeSingle();
    planoGm = planoGratMensal({
      fichas: fichasLidasValidas(data?.fichas_lidas), especie: processo.especie_divida, inicio: processo.periodo_inicio, fim: processo.periodo_fim,
      dados: dadosGm, dataRequerimento: processo.data_requerimento, hoje: new Date().toISOString().slice(0, 10),
    });
    notas = planoGm.notas;
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
      {autoGr && tipo === "recebido" && (
        <Aviso tipo="info">
          Gratificação de Representação: os lançamentos de Grat Rep das fichas só entram como recebidos quando marcados como deste evento
          no quadro de <Link href={`/processos/${id}/devidos`} className="underline">Lançar valor devido</Link>. Confira mês a mês; o que você digitar não é sobrescrito.
        </Aviso>
      )}
      {autoAf && tipo === "recebido" && (
        <Aviso tipo="info">
          Auxílio-fardamento: o recebido é o pagamento das fichas ligado ao 2º fato gerador, no quadro de{" "}
          <Link href={`/processos/${id}/devidos`} className="underline">Lançar valor devido</Link>. Confira; o que você digitar não é sobrescrito.
        </Aviso>
      )}
      {planoAf && <PainelAuxFard processoId={id} dados={dadosAf} plano={planoAf} bloqueado={bloqueado} leitura={leituraGuardada(processo.complementos)} />}
      {planoGr && (
        <PainelGratRep processoId={id} dados={dadosGr} plano={planoGr} inicio={processo.periodo_inicio} fim={processo.periodo_fim} bloqueado={bloqueado} leitura={leituraGuardada(processo.complementos)} />
      )}
      {planoGm && (
        <PainelGratMensal processoId={id} especie={processo.especie_divida ?? ""} dados={dadosGm} plano={planoGm} inicio={processo.periodo_inicio} fim={processo.periodo_fim} bloqueado={bloqueado} />
      )}
      {autoGm && tipo === "recebido" && (
        <Aviso tipo="info">
          Os recebidos desta gratificação são os lançamentos das fichas marcados no quadro de{" "}
          <Link href={`/processos/${id}/devidos`} className="underline">Lançar valor devido</Link>. Confira; o que você digitar não é sobrescrito.
        </Aviso>
      )}
      {/* o envio de contracheque e fichas fica só em "Informações" (pedido do usuário) */}
      <ValoresMensais key={autoGr || autoAf || autoGm ? processo.atualizado_em : undefined}
        processoId={id} tipo={tipo} proximaEtapa={proximaEtapa} bloqueado={bloqueado} rubricas={rub}
        inicio={mesDeData(processo.periodo_inicio)} fim={mesDeData(processo.periodo_fim)}
        linhas={lancamentos.filter((l) => l.tipo === tipo).map(({ ano, mes, posicao, valor }) => ({ ano, mes, posicao, valor }))}
        posPeriodo={tipo === "recebido" ? recebidosPosPeriodo(processo.complementos) : []}
        notas={notas}
      />
    </div>
  );
}
