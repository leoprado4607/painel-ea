/** Esqueleto mostrado na hora do clique, enquanto a página carrega no servidor. */
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4 motion-safe:animate-pulse">
      <div className="h-6 w-56 bg-borda/70" />
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="cartao space-y-3">
          <div className="h-4 w-40 bg-borda/70" />
          <div className="h-9 bg-fundo" />
          <div className="h-9 w-2/3 bg-fundo" />
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
