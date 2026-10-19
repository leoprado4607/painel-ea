import Link from "next/link";

/** Para abas só com valores calculados (Recapitulação, Resumo, Exercícios): onde editar os valores de base. */
export function AvisoSoCalculado({ processoId, titulo, descricao, children }: {
  processoId: string; titulo: string; descricao: string; children?: React.ReactNode;
}) {
  const link = (caminho: string, rotulo: string) => (
    <Link href={`/processos/${processoId}/${caminho}`} className="text-marca-700 underline">{rotulo}</Link>
  );
  return (
    <section className="cartao space-y-3 text-sm">
      <h2 className="font-semibold">{titulo}</h2>
      {children}
      <p className="text-suave">{descricao} Todos os valores são calculados a partir dos lançamentos.</p>
      <p>Para alterar, edite {link("recebidos", "Contracheque - F Financeira")}, {link("devidos", "Lançar valor devido")} ou {link("rubricas", "Códigos lançamento")}.</p>
    </section>
  );
}
