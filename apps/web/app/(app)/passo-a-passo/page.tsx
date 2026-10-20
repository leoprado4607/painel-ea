import Link from "next/link";
import { descreverRegra } from "@/lib/indice";
import { sessao } from "@/lib/sessao";
import { MESES } from "@/lib/tipos";

/** Etapas do sistema, na ordem das abas do rodapé (como a aba "Passo a Passo" da planilha). */
const ETAPAS: { aba: string; texto: string; href?: string }[] = [
  { aba: "Atualização do IPCA-E", href: "/ipca",
    texto: "Os índices são buscados todo dia no IBGE e no Banco Central. Confira até que mês a série está atualizada; se precisar, clique em “Buscar índices agora”." },
  { aba: "Dados da OM", href: "/om",
    texto: "Nome, RM, UG, CODOM, cidade e Ordenador de Despesas aparecem no cabeçalho e nas assinaturas. Só o Admin altera." },
  { aba: "Dados do favorecido",
    texto: "Abra ou crie um processo (menu “Novo processo”). Envie as fichas financeiras em PDF ou digite os dados do militar, o período e a espécie da dívida." },
  { aba: "Códigos lançamento", texto: "Confira as rubricas do processo. É possível alterar ou incluir códigos e marcar cada um como Receita ou Despesa." },
  { aba: "Contracheque - F Financeira", texto: "Valores recebidos, exatamente como na ficha financeira. Quando as fichas são enviadas, já vêm preenchidos para conferência." },
  { aba: "Lançar valor devido", texto: "Valores que o militar deveria ter recebido, mês a mês e rubrica a rubrica." },
  { aba: "Solicitação e Solicitação verso", texto: "Confira os dados, a numeração e os anexos. No verso, descreva o documento que materializou o direito e a explicação do não pagamento à época." },
  { aba: "CPEX", texto: "Folha para remessa ao CPEx. Preencha os dados do beneficiário da pensão judicial, se houver, e do operador que fará o lançamento no sistema." },
  { aba: "Recapitulação, Resumo e Exercícios por ano", texto: "Conferência dos totais de receitas, descontos e valor líquido, ano a ano." },
  { aba: "Impressão", texto: "Veja a prévia do pacote completo em PDF e emita. O PDF emitido fica guardado e o processo é travado; para corrigir, reabra e emita nova versão." },
];

export default async function PassoAPasso() {
  const { supabase } = await sessao();
  const [{ data: situacao }, { data: regras }] = await Promise.all([
    supabase.from("situacao_indices").select("serie, ultimo_mes"),
    supabase.from("regra_indice").select("vigencia_inicio, serie").order("vigencia_inicio"),
  ]);
  const ultimo = (situacao ?? []).map((s) => s.ultimo_mes as string).sort().pop();
  const ate = ultimo ? `${MESES[Number(ultimo.slice(5, 7)) - 1]}/${ultimo.slice(0, 4)}` : "—";
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-ouro-escuro">Exercício anterior · SEF · CPEx · SIAPPES</p>
        <h1 className="titulo-pagina">Passo a passo</h1>
        <p className="text-sm text-suave">
          Correção pela série {descreverRegra(regras ?? [])}, atualizada até <strong className="text-tinta">{ate}</strong>.
          Dentro do processo, siga as abas da barra lateral, de cima para baixo.
        </p>
      </header>
      <ol className="cartao divide-y divide-borda p-0">
        {ETAPAS.map((e, i) => (
          <li key={e.aba} className="grid gap-1 px-5 py-4 sm:grid-cols-[2.5rem_16rem_1fr] sm:gap-4">
            <span className="font-titulo text-2xl font-bold leading-none tabular-nums text-ouro-escuro">{i + 1}</span>
            <span className="font-titulo text-lg font-semibold leading-snug text-carvao">{e.href ? <Link href={e.href} className="underline-offset-2 hover:text-exercito hover:underline">{e.aba}</Link> : e.aba}</span>
            <span className="text-sm text-suave">{e.texto}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-suave">
        As abas do processo aparecem na barra lateral ao abrir um processo em{" "}
        <Link href="/processos" className="underline">Processos</Link>.
      </p>
    </div>
  );
}
