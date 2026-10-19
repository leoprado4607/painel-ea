"""Audita as abas anuais da planilha: toda referência a outra aba deve apontar para o mesmo ano.
Uso: python auditar_referencias.py  (lê planilha-original.xlsm, imprime as referências cruzadas erradas)"""
import collections, re, warnings
import openpyxl
warnings.filterwarnings("ignore")

wb = openpyxl.load_workbook("planilha-original.xlsm")
wv = openpyxl.load_workbook("planilha-original.xlsm", data_only=True)
calc_rotulos = {r: wv["Cálculo do Acumulado"].cell(r, 1).value for r in range(3, 1000)}

def ano_da_linha(aba, linha):
    if aba in ("Contracheque - F Financeira", "Lançar Valor Devido"):
        return 2006 + (linha - 5) // 19
    if aba in ("F Financeira-Corrigida", "Valor Devido - Corrigida"):
        return 2006 + (linha - 4) // 20
    if aba == "Valor_Líquido_Corrigido":
        return 2006 + (linha - 4) // 19
    if aba == "Cálculo do Acumulado":
        rot = calc_rotulos.get(linha) or ""
        return int(rot.split("/")[1]) if "/" in rot else None
    m = re.match(r"Solicitação (\d\d)( Verso)?$", aba) or re.match(r"(\d\d)-", aba)
    return 2000 + int(m.group(1)) if m else None

REF = re.compile(r"(?:'([^']+)'|([A-Za-zÀ-ú_][\wÀ-ú.]*))!\$?([A-Z]{1,3})\$?(\d+)")
anuais = [n for n in wb.sheetnames if re.match(r"^(Solicitação \d\d( Verso)?|\d\d-(Recebido|Devido))$", n)]
erros = collections.defaultdict(list)
for aba in anuais:
    ano = ano_da_linha(aba, 0)
    for row in wb[aba].iter_rows():
        for c in row:
            if not (isinstance(c.value, str) and c.value.startswith("=")):
                continue
            for m in REF.finditer(c.value):
                alvo, linha = (m.group(1) or m.group(2)).strip(), int(m.group(4))
                if alvo not in wb.sheetnames:
                    continue
                a = ano_da_linha(alvo, linha)
                if a is not None and a != ano:
                    erros[(aba, alvo, a)].append(c.coordinate)
for (aba, alvo, a), cels in sorted(erros.items()):
    print(f"{aba} (ano {ano_da_linha(aba,0)}) -> {alvo} do ano {a}: {len(cels)} células, ex. {', '.join(cels[:6])}")
print("total de grupos com erro:", len(erros))
