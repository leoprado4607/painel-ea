"""Auditoria estrutural da planilha: compara cada fórmula de cálculo com a fórmula que ela deveria ter,
pela posição (ano, rubrica, mês) do bloco onde está. Lista toda célula fora do padrão.

Uso: python auditar_estrutura.py  (lê planilha-original.xlsm)
"""
import collections
import re
import warnings

import openpyxl
from openpyxl.utils import get_column_letter as L

warnings.filterwarnings("ignore")
wb = openpyxl.load_workbook("planilha-original.xlsm")
ANOS = range(2006, 2029)
CF, LVD, FFC, VDC, VLC = ("Contracheque - F Financeira", "Lançar Valor Devido", "F Financeira-Corrigida",
                          "Valor Devido - Corrigida", "Valor_Líquido_Corrigido")
lanc = lambda y: 5 + 19 * (y - 2006)
cabc = lambda y: 4 + 20 * (y - 2006)
cabl = lambda y: 4 + 19 * (y - 2006)
yy = lambda y: f"{y % 100:02d}"
q = lambda aba: f"'{aba}'" if re.search(r"[^\w]", aba) else aba
norm = lambda f: (f or "").replace("$", "").replace(" ", "")

problemas = collections.defaultdict(list)


def conferir(grupo, aba, cel, esperado):
    real = wb[aba][cel].value
    if norm(real) != norm(esperado):
        problemas[grupo].append(f"{aba}!{cel}: tem {real}  | esperado {esperado}")


rotulos = {}
calc = wb["Cálculo do Acumulado"]
for r in range(3, 1000):
    if calc.cell(r, 1).value:
        rotulos[r] = calc.cell(r, 1).value

for y in ANOS:
    # abas de lançamento: linha TOTAL C/CHEQUE
    for aba in (CF, LVD):
        t = lanc(y) + 18
        for m in range(12):
            c = L(4 + m)
            conferir("Lançamento: total do mês", aba, f"{c}{t}",
                     f'=SUMIFS({c}{lanc(y)+1}:{c}{lanc(y)+17},C44:C60,"RECEITA")-SUMIFS({c}{lanc(y)+1}:{c}{lanc(y)+17},C44:C60,"DESPESA")')
    # corrigidas
    for aba, src in ((FFC, CF), (VDC, LVD)):
        cab = cabc(y)
        if wb[aba].cell(cab, 1).value != y:
            problemas["Corrigida: ano do bloco"].append(f"{aba}!A{cab}: {wb[aba].cell(cab, 1).value} (esperado {y})")
        for m in range(12):
            c, s = L(3 + m), L(4 + m)
            conferir("Corrigida: índice do mês", aba, f"{c}{cab+1}", f"=VLOOKUP({c}{cab},Calculo_do_Acumulado,5,0)")
            for p in range(17):
                r, rs = cab + 2 + p, lanc(y) + 1 + p
                conferir("Corrigida: valor corrigido", aba, f"{c}{r}", f"={q(src)}!{s}{rs}*{c}{cab+1}+{q(src)}!{s}{rs}")
            conferir("Corrigida: total do mês", aba, f"{c}{cab+19}",
                     f'=SUMIFS({c}{cab+2}:{c}{cab+18},B46:B62,"RECEITA")-SUMIFS({c}{cab+2}:{c}{cab+18},B46:B62,"DESPESA")')
        for p in range(18):
            r = cab + 2 + p
            conferir("Corrigida: total da linha", aba, f"O{r}", f"=SUM(C{r}:N{r})")
    # líquido
    cl = cabl(y)
    for m in range(12):
        c = L(3 + m)
        for p in range(17):
            rc = cabc(y) + 2 + p
            conferir("Líquido: valor", VLC, f"{c}{cl+1+p}", f'=IF({q(VDC)}!{c}{rc}="","",{q(VDC)}!{c}{rc}-{q(FFC)}!{c}{rc})')
        conferir("Líquido: total do mês", VLC, f"{c}{cl+18}",
                 f'=SUMIFS({c}{cl+1}:{c}{cl+17},B43:B59,"RECEITA")-SUMIFS({c}{cl+1}:{c}{cl+17},B43:B59,"DESPESA")')
    for p in range(18):
        conferir("Líquido: total da linha", VLC, f"O{cl+1+p}", f"=SUM(C{cl+1+p}:N{cl+1+p})")
    conferir("Líquido: receitas/despesas", VLC, f"P{cl+3}", f'=SUMIFS(O{cl+1}:O{cl+17},B43:B59,"RECEITA")')
    conferir("Líquido: receitas/despesas", VLC, f"P{cl+12}", f'=SUMIFS(O{cl+1}:O{cl+17},B43:B59,"DESPESA")')

    # Códigos-Anos
    col = L(3 + y - 2006)
    for p in range(17):
        r = lanc(y) + 1 + p
        conferir("Códigos-Anos: recebido", "Códigos-Anos", f"{col}{4+p}", f"=SUM({q(CF)}!D{r}:O{r})")
        conferir("Códigos-Anos: devido", "Códigos-Anos", f"{col}{24+p}", f"=SUM({q(LVD)}!D{r}:O{r})")
        conferir("Códigos-Anos: diferença", "Códigos-Anos", f"{col}{44+p}", f"={col}{24+p}-{col}{4+p}")
        conferir("Códigos-Anos: corrigido", "Códigos-Anos", f"{col}{64+p}", f"={VLC}!O{cl+1+p}")
    for base in (4, 24, 44, 64):
        conferir("Códigos-Anos: total", "Códigos-Anos", f"{col}{base+17}", f"=SUM({col}{base}:{col}{base+11})-SUM({col}{base+12}:{col}{base+16})")

    # Verso e Solicitação
    verso, solic = f"Solicitação {yy(y)} Verso", f"Solicitação {yy(y)}"
    v0 = min(int(c.coordinate[1:]) for row in wb[verso].iter_rows() for c in row
             if c.column == 4 and isinstance(c.value, str) and c.value.startswith("=SUM("))
    for p in range(18):
        r = lanc(y) + 1 + p
        conferir("Verso", verso, f"D{v0+p}", f"=SUM({q(LVD)}!D{r}:O{r})")
        conferir("Verso", verso, f"E{v0+p}", f"=SUM({q(CF)}!D{r}:O{r})")
        conferir("Verso", verso, f"F{v0+p}", f"=D{v0+p}-E{v0+p}")
        conferir("Verso", verso, f"G{v0+p}", f"={VLC}!O{cl+1+p}")
    s0 = min(int(c.coordinate[1:]) for row in wb[solic].iter_rows() for c in row
             if c.column == 4 and isinstance(c.value, str) and "Verso'!F" in c.value)
    for p in range(17):
        conferir("Solicitação", solic, f"D{s0+p}", f"={q(verso)}!F{v0+p}")
        conferir("Solicitação", solic, f"E{s0+p}", f"={q(verso)}!G{v0+p}")

    # NN-Recebido / NN-Devido
    for aba, src in ((f"{yy(y)}-Recebido", CF), (f"{yy(y)}-Devido", LVD)):
        for g in range(4):
            cab = 7 + 19 * g
            for k in range(3):
                m = 3 * g + k
                cv, ci = L(3 + 3 * k), L(5 + 3 * k)
                lab = wb[aba][f"{L(4+3*k)}{cab}"].value
                mm = re.search(r"!A(\d+)", lab or "")
                if not mm or rotulos.get(int(mm.group(1)), "").lower() != f"{['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][m]}/{y}":
                    problemas["Recebido/Devido: mês do índice"].append(f"{aba}!{L(4+3*k)}{cab}: {lab} -> {rotulos.get(int(mm.group(1))) if mm else '?'}")
                for p in range(17):
                    r = cab + 1 + p
                    conferir("Recebido/Devido: valor", aba, f"{cv}{r}", f"={q(src)}!{L(4+m)}{lanc(y)+1+p}")
                    conferir("Recebido/Devido: corrigido", aba, f"{ci}{r}", f"={cv}{r}*{ci}{cab}+{cv}{r}")

    # Recapitulação
    conferir("Recapitulação", "Solicitação Recapitulação", f"C{20+y-2006}", f"={VLC}!P{cl+3}")
    conferir("Recapitulação", "Solicitação Recapitulação", f"E{20+y-2006}", f"={VLC}!P{cl+12}")

# Resumo (2006…2028)
for y in ANOS:
    k, lado = divmod(y - 2006, 2)
    cab = 8 + 20 * k
    verso = f"Solicitação {yy(y)} Verso"
    v0 = min(int(c.coordinate[1:]) for row in wb[verso].iter_rows() for c in row
             if c.column == 4 and isinstance(c.value, str) and c.value.startswith("=SUM("))
    ca, cb = ("C", "D") if lado == 0 else ("H", "I")
    for p in range(18):
        conferir("Resumo", "Resumo", f"{ca}{cab+1+p}", f"={q(verso)}!D{v0+p}")
        conferir("Resumo", "Resumo", f"{cb}{cab+1+p}", f"={q(verso)}!E{v0+p}")

# CPEX
for p in range(17):
    conferir("CPEX", "CPEX", f"F{16+p}", f"='Códigos-Anos'!AA{44+p}")
    conferir("CPEX", "CPEX", f"I{16+p}", f"='Códigos-Anos'!AA{64+p}")

total = 0
for grupo, itens in problemas.items():
    total += len(itens)
    print(f"\n## {grupo}: {len(itens)}")
    for i in itens[:12]:
        print("  ", i)
    if len(itens) > 12:
        print(f"   … mais {len(itens) - 12}")
print("\nTOTAL de células fora do padrão:", total)
