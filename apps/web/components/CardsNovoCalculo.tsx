import Link from "next/link";
import { CARDS_NOVO_CALCULO } from "@/lib/novo-calculo";

/** Cards de "Novo cálculo": um acesso direto por espécie com cálculo automático e "Demais assuntos". */
export function CardsNovoCalculo() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CARDS_NOVO_CALCULO.map((c) => (
        <Link key={c.id} href={`/processos/novo?especie=${c.id}`}
          className={`cartao flex flex-col gap-2 transition hover:border-marca-600 hover:shadow-md ${c.automatico ? "" : "border-dashed"}`}>
          <span className={`w-fit px-2 py-0.5 text-xs font-semibold ${c.automatico ? "bg-marca-600 text-white" : "border border-borda text-suave"}`}>
            {c.automatico ? "Cálculo automático" : "Cálculo pelo operador"}
          </span>
          <span className="text-lg font-semibold">{c.titulo}</span>
          <span className="text-sm text-suave">{c.resumo}</span>
        </Link>
      ))}
    </div>
  );
}
