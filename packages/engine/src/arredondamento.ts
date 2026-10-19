/**
 * Arredondamento igual ao do Excel (meio para longe do zero), feito sobre a representação decimal
 * de 15 dígitos significativos, para não sofrer com erros binários (ex.: 1.005 vira 1.01, como no Excel).
 *
 * A planilha original usa "Precisão conforme exibido" (fullPrecision="0"): cada célula guarda o valor
 * já arredondado ao número de casas do seu formato. O motor aplica `arredondar` nos mesmos pontos.
 */
export function arredondar(x: number, casas: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const negativo = x < 0;
  const [mantissa, expoente] = Math.abs(x).toPrecision(15).split("e");
  const [inteiro, fracao = ""] = mantissa!.split(".");
  const digitos = inteiro! + fracao;
  // valor = 0.<digitos> × 10^posicaoVirgula
  const posicaoVirgula = inteiro!.length + (expoente ? Number(expoente) : 0);
  const manter = posicaoVirgula + casas;
  if (manter < 0) return 0;
  if (manter >= digitos.length) return x;
  let mantidos = BigInt(digitos.slice(0, manter) || "0");
  if (digitos.charCodeAt(manter) >= 53 /* '5' */) mantidos += 1n;
  const r = Number(`${mantidos}e${-casas}`);
  return negativo ? -r : r;
}

/** Valores monetários: formato #,##0.00. */
export const dinheiro = (x: number): number => arredondar(x, 2);

/** Soma na mesma ordem do SUM do Excel. */
export const somar = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
