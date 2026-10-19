/**
 * Validações de dígito verificador da aba "Informações" (colunas K a AP, linhas 21 a 23).
 */

const soDigitos = (x: number | string) => String(x).replace(/\D/g, "");
const somaDosDigitos = (n: number) => Math.floor(n / 10) + (n % 10);
/** IF(s<=10;10;IF(s<=20;20;…;90)) − s */
const complementoDezena = (s: number) => (s <= 10 ? 10 : Math.min(Math.ceil(s / 10) * 10, 90)) - s;

/**
 * Prec-CP (Informações!B22, conferido em L21).
 * Sobre os dígitos de (PrecCP + 1.000.000.000): posições 4–9 com pesos 1,2,1,2,1,2,
 * somando os algarismos de cada produto; o dígito na posição 10 deve completar a dezena seguinte.
 */
export function precCpValido(precCp: number | string): boolean {
  const n = Number(soDigitos(precCp) || "0");
  const s = String(n + 1_000_000_000);
  const d = (pos: number) => Number(s[pos - 1]);
  const pesos: [number, number][] = [[4, 1], [5, 2], [6, 1], [7, 2], [8, 1], [9, 2]];
  const soma = pesos.reduce((acc, [pos, peso]) => acc + somaDosDigitos(d(pos) * peso), 0);
  return d(10) === complementoDezena(soma);
}

/** CPF no formato 000.000.000-00 (Informações!B24, conferido em L23). Regra padrão de módulo 11. */
export function cpfValido(cpf: string): boolean {
  const dig = soDigitos(cpf);
  if (dig.length !== 11 || /^(\d)\1{10}$/.test(dig)) return false; // 111.111.111-11 passa no módulo 11, mas não existe
  const d = [...dig].map(Number);
  const dv = (n: number) => {
    const soma = d.slice(0, n).reduce((acc, x, i) => acc + x * (n + 1 - i), 0);
    const r = 11 - (soma % 11);
    return r >= 10 ? 0 : r;
  };
  return d[9] === dv(9) && d[10] === dv(10);
}

/**
 * Identidade militar no formato 000.000.000-0 (Informações!B23).
 * ATENÇÃO: na planilha esta conferência está quebrada (AJ22 contém #REF!). A regra abaixo é a
 * pretendida pelas fórmulas (pesos 2,1,2,1,… nas 9 primeiras posições, soma dos algarismos dos
 * produtos, dígito completa a dezena seguinte) e precisa ser confirmada com identidades reais.
 */
export function identidadeValida(identidade: string): boolean {
  const dig = soDigitos(identidade);
  if (dig.length !== 10) return false;
  const d = [...dig].map(Number);
  const soma = d.slice(0, 9).reduce((acc, x, i) => acc + somaDosDigitos(x * (i % 2 === 0 ? 2 : 1)), 0);
  return d[9] === complementoDezena(soma);
}
