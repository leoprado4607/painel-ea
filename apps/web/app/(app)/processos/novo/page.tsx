import Link from "next/link";
import { CardsNovoCalculo } from "@/components/CardsNovoCalculo";
import { NovoPorFichas } from "@/components/NovoPorFichas";
import { cardNovoCalculo } from "@/lib/novo-calculo";
import { omsParaEscolha } from "@/lib/processo";
import { sessao } from "@/lib/sessao";

/** Novo cálculo: 1º escolhe o assunto (cards); 2º envia as fichas financeiras e o contracheque (obrigatórios). */
export default async function NovoProcesso({ searchParams }: { searchParams: Promise<{ especie?: string }> }) {
  const card = cardNovoCalculo((await searchParams).especie);
  if (!card) {
    return (
      <div className="space-y-4">
        <Link href="/processos" className="text-sm text-marca-700 hover:underline">← Processos</Link>
        <h1 className="titulo-pagina">Novo cálculo</h1>
        <p className="text-sm text-suave">Escolha o assunto do cálculo.</p>
        <CardsNovoCalculo />
      </div>
    );
  }
  const { supabase, perfil } = await sessao();
  const oms = await omsParaEscolha(supabase, perfil);
  return (
    <div className="space-y-4">
      <Link href="/processos/novo" className="text-sm text-marca-700 hover:underline">← Escolher outro assunto</Link>
      <h1 className="titulo-pagina">Novo cálculo: {card.titulo}</h1>
      <NovoPorFichas oms={oms} especie={card.id} />
    </div>
  );
}
