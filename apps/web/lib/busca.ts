/** Texto para pesquisa: sem acento, em minúsculas e com espaços simples (a pesquisa não depende disso). */
export const normalizarBusca = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
