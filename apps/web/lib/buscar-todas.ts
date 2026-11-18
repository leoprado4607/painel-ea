type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** O banco devolve no máximo 1.000 linhas por consulta: busca página a página até acabar (a consulta precisa ter ordem fixa). */
export async function buscarTodas<T>(consulta: (de: number, ate: number) => Pagina<T>, tamanho = 1000): Promise<T[]> {
  const linhas: T[] = [];
  for (;;) {
    const { data, error } = await consulta(linhas.length, linhas.length + tamanho - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return linhas;
    linhas.push(...data);
  }
}
