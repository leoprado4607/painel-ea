"""Lê as cópias recalculadas em saida/*.xlsm e grava os valores de todas as células com fórmula
em packages/engine/test/golden/<caso>.json (formato {aba: {celula: valor}}), para os testes do motor."""
import datetime
import glob
import json
import os
import re
import shutil
import warnings

import openpyxl

warnings.filterwarnings("ignore")
AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(AQUI, "..", "..", "packages", "engine", "test", "golden")

ABAS_FIXAS = [
    "Cálculo do Acumulado", "Informações", "Lista_Suspensa", "Contracheque - F Financeira", "Lançar Valor Devido",
    "F Financeira-Corrigida", "Valor Devido - Corrigida", "Valor_Líquido_Corrigido", "Códigos-Anos",
    "CPEX", "Solicitação Recapitulação", "Resumo",
]
POR_ANO = re.compile(r"^(Solicitação \d\d( Verso)?|\d\d-(Recebido|Devido))$")


def valor_json(v):
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return v.isoformat()
    return v


def casas_decimais(formato):
    """Casas guardadas pela "Precisão conforme exibido"; None = sem arredondamento (General, texto, data)."""
    secao = formato.split(";")[0]
    if formato in ("General", "@") or any(t in secao.lower() for t in ("yy", "mmm", "dd")):
        return None
    secao = re.sub(r'"[^"]*"|\\.|_.|\[[^\]]*\]', "", secao)
    m = re.search(r"\.([0#]+)", secao)
    casas = len(m.group(1)) if m else 0
    return casas + 2 if "%" in secao else casas


def main():
    os.makedirs(DESTINO, exist_ok=True)
    formulas = openpyxl.load_workbook(os.path.join(AQUI, "planilha-original.xlsm"))
    abas = [n for n in formulas.sheetnames if n in ABAS_FIXAS or POR_ANO.match(n)]
    celulas = {
        aba: [c.coordinate for row in formulas[aba].iter_rows() for c in row
              if isinstance(c.value, str) and c.value.startswith("=")]
        for aba in abas
    }
    for arq in sorted(glob.glob(os.path.join(AQUI, "saida", "*.xlsm"))):
        nome = os.path.splitext(os.path.basename(arq))[0]
        wb = openpyxl.load_workbook(arq, data_only=True)
        out = {aba: {cel: valor_json(wb[aba][cel].value) for cel in cels} for aba, cels in celulas.items()}
        with open(os.path.join(DESTINO, f"{nome}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        print("ok:", nome, sum(len(v) for v in out.values()), "células")
    # Fórmulas (e constantes numéricas) das abas comparadas, com as casas decimais do formato de cada
    # célula: a planilha usa "Precisão conforme exibido", então cada célula é arredondada a essas casas.
    exportar = {}
    for aba in abas + ["Cálculo do Acumulado"]:
        cels = {}
        for row in formulas[aba].iter_rows():
            for c in row:
                v = c.value
                if isinstance(v, str) and v.startswith("="):
                    cels[c.coordinate] = [v, casas_decimais(c.number_format)]
                elif isinstance(v, (int, float)) and not isinstance(v, bool):
                    cels[c.coordinate] = [v, casas_decimais(c.number_format)]
                elif isinstance(v, str) and aba == "Cálculo do Acumulado" and c.column == 1:
                    cels[c.coordinate] = [v, None]  # rótulos "Mês/Ano" usados pelos PROCV
        exportar[aba] = cels
    with open(os.path.join(DESTINO, "formulas.json"), "w", encoding="utf-8") as f:
        json.dump(exportar, f, ensure_ascii=False, separators=(",", ":"))

    # Série de índices da planilha (coluna B de "Cálculo do Acumulado"), usada como entrada do motor.
    valores = openpyxl.load_workbook(os.path.join(AQUI, "planilha-original.xlsm"), data_only=True)
    calc = valores["Cálculo do Acumulado"]
    meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro",
             "Outubro", "Novembro", "Dezembro"]
    indices = []
    for r in range(3, 1000):
        rotulo = calc.cell(r, 1).value
        if not rotulo:
            continue
        nome_mes, ano = rotulo.split("/")
        indices.append({"ano": int(ano), "mes": meses.index(nome_mes) + 1, "percentual": calc.cell(r, 2).value})
    with open(os.path.join(DESTINO, "indices-planilha.json"), "w", encoding="utf-8") as f:
        json.dump(indices, f)
    for arq in glob.glob(os.path.join(AQUI, "casos", "*.entrada.json")):
        shutil.copy(arq, DESTINO)
    shutil.copy(os.path.join(AQUI, "saida", "validacoes.json"), DESTINO)


if __name__ == "__main__":
    main()
