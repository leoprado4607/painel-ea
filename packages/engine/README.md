# @painel-ea/engine — motor de cálculo

Reproduz as regras da planilha "EA - MA - IPCA" sem depender do Excel. É código puro: sem banco e sem tela.

```ts
import { calcular } from "@painel-ea/engine";
const r = calcular({ indices, rubricas, recebido, devido });
r.cpex.importanciaBasicaTotalCorrigida; // total da folha CPEX
r.porAno[2021].verso;                   // valores da "Solicitação 21 Verso"
```

- `src/indices.ts`: aba "Cálculo do Acumulado" (fator acumulado do IPCA).
- `src/calculo.ts`: correção, líquido, Códigos-Anos, CPEX, Recapitulação, Verso e Solicitação por ano.
- `src/validacao.ts`: dígito verificador de Prec-CP, CPF e identidade.
- `src/arredondamento.ts`: arredondamento estilo Excel. A planilha usa "Precisão conforme exibido", então cada valor é arredondado às casas do formato da célula original.

## Testes

```bash
npm test
```

| Arquivo | O que prova |
|---|---|
| `test/emulacao.test.ts` | Um avaliador lê as fórmulas reais da planilha e recalcula **todas** as ≈ 46,7 mil células numéricas de cada caso, chegando ao mesmo valor que o Excel. |
| `test/golden.test.ts` | O motor bate célula a célula com a planilha. As únicas diferenças aceitas estão nas regiões dos erros de fórmula da planilha (P1, P9–P14, ver `PLANO.md`), e cada erro declarado precisa aparecer nos casos. Também confere que toda célula numérica de cálculo tem correspondência no motor. |
| `test/validacao.test.ts` | Prec-CP e CPF dão o mesmo OK/Erro que o Excel; arredondamento; quantidade de meses. |

Os casos fictícios ficam em `test/golden/` e são gerados por `tools/golden/`. É preciso ter o Excel instalado para gerá-los de novo:

```bash
cd tools/golden && .venv/Scripts/python casos.py && powershell -ExecutionPolicy Bypass -File aplicar.ps1 && .venv/Scripts/python extrair.py
```

Auditorias da planilha original: `tools/golden/auditar_estrutura.py` (fórmulas fora do padrão do bloco) e `tools/golden/auditar_referencias.py` (referências a outro ano).
