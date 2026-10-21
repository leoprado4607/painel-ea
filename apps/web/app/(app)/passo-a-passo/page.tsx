import Link from "next/link";
import { sessao } from "@/lib/sessao";

/** Etapas do sistema, na ordem do menu e das abas do processo (como a aba "Passo a Passo" da planilha). */
const ETAPAS: { aba: string; texto: string; href?: string; soAdmin?: boolean }[] = [
  { aba: "Atualização do IPCA-E", href: "/ipca",
    texto: "Os índices são buscados todo dia no IBGE e no Banco Central. Confira até que mês a série está atualizada; se precisar, clique em “Buscar índices agora”." },
  { aba: "Dados da OM", href: "/om", soAdmin: true,
    texto: "OM do Ordenador de Despesas, RM, UG, cidade e Ordenador de Despesas aparecem no cabeçalho e nas assinaturas dos documentos. O nome da OM e o CODOM são os da OM de vinculação de cada militar, escolhida em Informações." },
  { aba: "Informações",
    texto: "Abra ou crie um processo (menu “Novo processo”). Envie as fichas financeiras (SIPPES ou SIAPPES) e o contracheque em PDF, ou digite os dados do militar, o período e a espécie da dívida." },
  { aba: "Códigos lançamento", texto: "Confira as rubricas do processo. É possível alterar ou incluir códigos e marcar cada um como Receita ou Despesa." },
  { aba: "Contracheque - F Financeira", texto: "Valores recebidos, exatamente como na ficha financeira. Quando as fichas são enviadas, já vêm preenchidos para conferência." },
  { aba: "Lançar valor devido", texto: "Valores que o militar deveria ter recebido, mês a mês e rubrica a rubrica." },
  { aba: "Impressão", texto: "Veja a prévia do pacote completo em PDF e emita. O PDF emitido fica guardado e o processo é travado; para corrigir, reabra e emita nova versão." },
  { aba: "Solicitação e Solicitação verso", texto: "Confira os dados, a numeração e os anexos. No verso, descreva o documento que materializou o direito e a explicação do não pagamento à época." },
  { aba: "CPEX", texto: "Folha para remessa ao CPEx. Preencha os dados do beneficiário da pensão judicial, se houver, e do operador que fará o lançamento no sistema." },
  { aba: "Recapitulação, Resumo e Exercícios por ano", texto: "Conferência dos totais de receitas, descontos e valor líquido, ano a ano." },
];

export default async function PassoAPasso() {
  const { perfil } = await sessao();
  // cada perfil vê só as etapas que pode usar (Dados da OM é do Admin)
  const etapas = ETAPAS.filter((e) => !e.soAdmin || perfil?.papel === "admin");
  return (
    <div className="space-y-5">
      {/* sem cabeçalho visível (pedido do usuário); o título fica para leitores de tela */}
      <h1 className="sr-only">Passo a passo</h1>
      <ol className="cartao divide-y divide-borda p-0">
        {etapas.map((e, i) => (
          <li key={e.aba} className="grid gap-1 px-5 py-4 sm:grid-cols-[2.5rem_16rem_1fr] sm:gap-4">
            <span className="font-titulo text-2xl font-bold leading-none lining-nums tabular-nums text-ouro-escuro">{i + 1}</span>
            <span className="font-titulo text-lg font-semibold leading-snug text-carvao">{e.href ? <Link href={e.href} className="underline-offset-2 hover:text-exercito hover:underline">{e.aba}</Link> : e.aba}</span>
            <span className="text-sm text-suave">{e.texto}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
