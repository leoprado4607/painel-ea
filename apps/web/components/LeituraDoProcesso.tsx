import type { LeituraGuardada } from "@/lib/processo-completo";

/** O que veio do processo completo (lib/processo-completo): avisos e o que foi aproveitado de cada peça. */
export function LeituraDoProcesso({ leitura }: { leitura: LeituraGuardada }) {
  return (
    <details className="border border-borda p-3 text-sm" open={leitura.avisos.length > 0}>
      <summary className="cursor-pointer font-semibold">Lido do processo completo ({leitura.pecas.length} peças){leitura.avisos.length ? `: ${leitura.avisos.length} aviso(s)` : ""}</summary>
      {leitura.avisos.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">{leitura.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
      <table className="mt-2 w-full text-left text-xs">
        <thead><tr className="text-suave"><th className="py-1 pr-2 font-normal">Peça</th><th className="py-1 font-normal">O que foi aproveitado</th></tr></thead>
        <tbody>{leitura.pecas.map((p, i) => <tr key={i} className="border-t border-borda"><td className="py-1 pr-2">{p.nome}</td><td className="py-1">{p.uso}</td></tr>)}</tbody>
      </table>
      <p className="ajuda mt-2">Os dados lidos são sugestões: confira as Informações e este quadro antes de salvar.</p>
    </details>
  );
}
