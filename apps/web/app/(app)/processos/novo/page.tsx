import Link from "next/link";
import { FormularioProcesso } from "@/components/FormularioProcesso";
import { NovoPorFichas } from "@/components/NovoPorFichas";
import { omsParaEscolha } from "@/lib/processo";
import { sessao } from "@/lib/sessao";

export default async function NovoProcesso() {
  const { supabase, perfil } = await sessao();
  const oms = await omsParaEscolha(supabase, perfil);
  return (
    <div className="space-y-4">
      <Link href="/processos" className="text-sm text-marca-700 hover:underline">← Processos</Link>
      <h1 className="titulo-pagina">Novo cálculo</h1>
      <NovoPorFichas oms={oms} />
      <details className="cartao">
        <summary className="cursor-pointer font-semibold">Preencher manualmente</summary>
        <div className="mt-4">
          <FormularioProcesso processoId={null} oms={oms} />
        </div>
      </details>
    </div>
  );
}
