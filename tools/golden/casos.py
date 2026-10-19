"""Gera os casos de teste fictícios (entradas) usados para comparar o motor com a planilha.

Cada caso vira dois arquivos em casos/:
  <nome>.entrada.json  -> entrada no formato do motor (TypeScript)
  <nome>.escritas.json -> células que o aplicar.ps1 escreve numa cópia da planilha

Todos os nomes, números e valores são inventados.
"""
import json
import os
import random

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "casos")
ANO_INICIAL = 2006
ANOS = list(range(2006, 2029))
COLS_MES = "DEFGHIJKLMNO"  # janeiro..dezembro nas abas de lançamento

CODIGOS_PADRAO = [
    ("A01 - SOLDO", "Receita"), ("A03 - ADIC HAB", "Receita"), ("A14 - ADIC MIL", "Receita"),
    ("AL0 - ACDM", "Receita"), ("A85 - ADIC NATAL - 2ª P", "Receita"), ("AD2 - ADICIONAL FÉRIAS", "Receita"),
    ("", "Receita"), ("", "Receita"), ("", "Receita"), ("", "Receita"), ("", "Receita"), ("", "Receita"),
    ("Z01 - FUSEX", "Despesa"), ("Z02 - P MIL 7,5/9,5/10,5%", "Despesa"), ("Z02 - P MIL 1,5%", "Despesa"),
    ("Z99 - PENS JUDICIARIA", "Despesa"), ("ZM7 - DESC DEP FUSEX", "Despesa"),
]


def linha_lancamento(ano, slot):
    """Linha da rubrica `slot` (1..17) do ano nas abas Contracheque / Lançar Valor Devido."""
    return 5 + 19 * (ano - ANO_INICIAL) + slot


def vazio():
    return {str(a): {} for a in ANOS}


def put(tab, ano, slot, meses, valor_fn):
    linha = tab[str(ano)].setdefault(str(slot), [None] * 12)
    for m in meses:
        linha[m - 1] = valor_fn(m)


def informacoes_ficticias(ini, fim):
    return {
        "B4": "1º Batalhão Fictício de Testes", "B5": "11ª", "B6": "160000", "B7": "000001",
        "B8": "Cel Fulano de Tal", "B10": "Maj Beltrano", "B12": "Ten Cel Sicrano",
        "B14": "Brasília-DF", "B15": "001/2026", "B16": 2026,
        "B20": "1º Sgt", "B21": "João Teste da Silva",
        "B25": "001 - Brasil", "B26": "1234-5", "B27": "98765-4",
        "A29": "Diferença de adicional (teste)", "A31": "17 de outubro de 2026", "A33": "Ativa",
        "H30": f"=DATE({ini[0]},{ini[1]},1)", "H31": f"=DATE({fim[0]},{fim[1]},1)",
    }


def caso(nome, descricao, codigos, recebido, devido, info):
    escritas = []
    for i, (cod, tipo) in enumerate(codigos):
        escritas.append({"aba": "Códigos Lançamento", "celula": f"A{3+i}", "valores": [cod if cod else None]})
        escritas.append({"aba": "Códigos Lançamento", "celula": f"B{3+i}", "valores": [tipo]})
    for cel, v in info.items():
        escritas.append({"aba": "Informações", "celula": cel, "valores": [v]})
    for aba, tab in (("Contracheque - F Financeira", recebido), ("Lançar Valor Devido", devido)):
        for ano, slots in tab.items():
            for slot, vals in slots.items():
                r = linha_lancamento(int(ano), int(slot))
                escritas.append({"aba": aba, "celula": f"D{r}", "valores": vals})
    entrada = {
        "nome": nome, "descricao": descricao,
        "rubricas": [{"codigo": c, "tipo": t} for c, t in codigos],
        "recebido": recebido, "devido": devido,
        "periodo": {"inicio": info["H30"], "fim": info["H31"]},
        "informacoes": info,
    }
    with open(os.path.join(SAIDA, f"{nome}.entrada.json"), "w", encoding="utf-8") as f:
        json.dump(entrada, f, ensure_ascii=False, indent=1)
    with open(os.path.join(SAIDA, f"{nome}.escritas.json"), "w", encoding="utf-8") as f:
        json.dump({"nome": nome, "escritas": escritas}, f, ensure_ascii=False, indent=1)


def dinheiro(rng, lo, hi):
    return round(rng.uniform(lo, hi), 2)


def main():
    os.makedirs(SAIDA, exist_ok=True)

    # c01: um ano, soldo e FUSEX, valores redondos.
    rec, dev = vazio(), vazio()
    put(rec, 2020, 1, range(1, 13), lambda m: 5000.00)
    put(dev, 2020, 1, range(1, 13), lambda m: 5500.00)
    put(rec, 2020, 13, range(1, 13), lambda m: 150.00)
    put(dev, 2020, 13, range(1, 13), lambda m: 165.00)
    caso("c01_simples", "Um ano (2020), soldo e FUSEX constantes.", CODIGOS_PADRAO, rec, dev,
         informacoes_ficticias((2020, 1), (2020, 12)))

    # c02: 2016–2026 (inclui 2026, afetado pelo problema P1), várias rubricas, centavos e meses parciais.
    rng = random.Random(2)
    rec, dev = vazio(), vazio()
    for ano in range(2016, 2027):
        meses = range(1, 10) if ano == 2026 else range(1, 13)
        for slot in (1, 2, 3, 4, 13, 14, 16):
            base = dinheiro(rng, 200, 9000)
            put(rec, ano, slot, meses, lambda m: round(base + rng.uniform(-50, 50), 2))
            put(dev, ano, slot, meses, lambda m: round(base * rng.uniform(0.9, 1.25), 2))
        put(rec, ano, 5, [12], lambda m: dinheiro(rng, 3000, 8000))
        put(dev, ano, 5, [12], lambda m: dinheiro(rng, 3000, 9000))
        put(dev, ano, 6, [7], lambda m: dinheiro(rng, 1000, 3000))
    caso("c02_varios_anos", "2016 a 2026, sete rubricas, centavos, devido maior e menor que o recebido.",
         CODIGOS_PADRAO, rec, dev, informacoes_ficticias((2016, 1), (2026, 9)))

    # c03: valores em 2006, 2007 e 2010 (problema P2: CPEX ignora 2006–2007).
    rec, dev = vazio(), vazio()
    for ano in (2006, 2007, 2010):
        put(rec, ano, 1, range(1, 13), lambda m: 1000.00)
        put(dev, ano, 1, range(1, 13), lambda m: 1100.00)
        put(rec, ano, 13, range(1, 13), lambda m: 30.00)
        put(dev, ano, 13, range(1, 13), lambda m: 33.00)
    caso("c03_2006_2007", "Valores em 2006, 2007 e 2010.", CODIGOS_PADRAO, rec, dev,
         informacoes_ficticias((2006, 1), (2010, 12)))

    # c04: todos os anos e meses, 17 posições (códigos próprios, um "-" e uma posição vazia).
    rng = random.Random(4)
    codigos = list(CODIGOS_PADRAO)
    codigos[6] = ("B01 - RUBRICA TESTE 1", "Receita")
    codigos[7] = ("B02 - RUBRICA TESTE 2", "Despesa")
    codigos[8] = ("B03 - RUBRICA NEUTRA", "-")
    codigos[9] = ("", "Receita")
    codigos[10] = ("B05 - RUBRICA TESTE 5", "Receita")
    rec, dev = vazio(), vazio()
    for ano in ANOS:
        for slot in range(1, 18):
            if rng.random() < 0.15:
                continue
            put(rec, ano, slot, range(1, 13), lambda m: dinheiro(rng, 0, 12000) if rng.random() > 0.1 else None)
            put(dev, ano, slot, range(1, 13), lambda m: dinheiro(rng, 0, 13000) if rng.random() > 0.1 else None)
    caso("c04_completo", "2006 a 2028, todas as posições, códigos próprios, tipo '-', posição vazia.",
         codigos, rec, dev, informacoes_ficticias((2006, 1), (2028, 12)))

    # Validação de Prec-CP e CPF: números inventados, o Excel diz OK/Erro.
    rng = random.Random(7)
    precs = [rng.randrange(10**8, 10**9) for _ in range(40)]
    cpfs = []
    for _ in range(40):
        d = [rng.randrange(10) for _ in range(9)]
        s1 = sum(x * w for x, w in zip(d, range(10, 1, -1))); v1 = 11 - s1 % 11; v1 = 0 if v1 >= 10 else v1
        s2 = sum(x * w for x, w in zip(d + [v1], range(11, 1, -1))); v2 = 11 - s2 % 11; v2 = 0 if v2 >= 10 else v2
        dv = f"{v1}{v2}" if rng.random() < 0.6 else f"{(v1 + 1) % 10}{v2}"
        n = "".join(map(str, d))
        cpfs.append(f"{n[:3]}.{n[3:6]}.{n[6:]}-{dv}")
    with open(os.path.join(SAIDA, "validacoes.entrada.json"), "w", encoding="utf-8") as f:
        json.dump({"precCp": precs, "cpf": cpfs}, f, indent=1)
    print("casos gerados em", SAIDA)


if __name__ == "__main__":
    main()
