"""Cruza os catálogos SIAPPES (códigos da planilha) e SIPPES (códigos das fichas atuais).

Regras, da mais forte para a mais fraca:
  explicita  - a descrição do SIPPES começa com o código do SIAPPES ("Z79 - INDZ MAT DIDAT")
  padrao     - mesma numeração (A01↔NR0001, Z05↔ND0005) e descrições parecidas
  descricao  - descrições parecidas, sem a mesma numeração
Grava saida/cruzamento.json e saida/cruzamento.csv (para revisão em planilha).
"""
import csv
import json
import os
import re
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")
ABREV = {"ADIC": "ADICIONAL", "HAB": "HABILITACAO", "MIL": "MILITAR", "AD": "ADICIONAL", "DESC": "DESCONTO",
         "DEP": "DEPENDENTE", "PENS": "PENSAO", "P": "PENSAO", "COMP": "COMPENSACAO", "CORG": "ORGANICA",
         "GRAT": "GRATIFICACAO", "AUX": "AUXILIO", "ALIM": "ALIMENTACAO", "FARD": "FARDAMENTO", "SV": "SERVICO",
         "JUD": "JUDICIAL", "JUDICIARIA": "JUDICIAL", "ALI": "ALIMENTICIA", "FERIAS": "FERIAS", "PARC": "PARCELA"}
VAZIAS = {"DE", "DA", "DO", "E", "-", "A", "O", "EM"}


def normal(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().upper()
    t = re.sub(r"[^A-Z0-9%,. ]", " ", t)
    return [ABREV.get(p, p) for p in t.split() if p not in VAZIAS]


def parecida(a, b):
    """Fração das palavras da descrição curta (SIAPPES) que aparecem, inteiras ou como prefixo, na do SIPPES."""
    ta, tb = normal(a), normal(b)
    if not ta or not tb:
        return 0.0
    achou = sum(1 for x in ta if any(y == x or (len(x) > 1 and len(y) > 1 and (y.startswith(x) or x.startswith(y))) for y in tb))
    return achou / len(ta)


def main():
    siappes = json.load(open(os.path.join(SAIDA, "siappes.json"), encoding="utf-8"))
    sippes = json.load(open(os.path.join(SAIDA, "sippes.json"), encoding="utf-8"))
    por_cod = {s["codigo"]: s for s in siappes}
    res = {}

    for n in sippes:
        m = re.match(r"^([A-Z0-9]{3})\s*-\s*", n["descricao"])
        if m and m.group(1) in por_cod:
            res[n["codigo"]] = (m.group(1), "explicita", 1.0)

    for n in sippes:
        if n["codigo"] in res:
            continue
        num = int(n["codigo"][2:])
        letra = "A" if n["codigo"].startswith("NR") else "Z"
        cand = f"{letra}{num:02d}" if num < 100 else None
        if cand and cand in por_cod:
            sim = parecida(por_cod[cand]["descricao"], n["descricao"])
            if sim >= 0.5:
                res[n["codigo"]] = (cand, "padrao", sim)
                continue
        # melhor descrição na mesma natureza (receita: categorias 1/2 do SIAPPES; desconto: 9)
        # só rubricas da ativa: receitas com prefixo A, descontos com Z; sem variantes de atrasado (AT/EA)
        prefixo = "A" if n["codigo"].startswith("NR") else "Z"
        candidatos = [s for s in siappes if s["codigo"].startswith(prefixo)
                      and not re.search(r"\b(AT|EA)$", s["descricao"]) and not s["descricao"].startswith("DA ")]
        # similaridade nos dois sentidos: prefere descrições equivalentes, não só contidas uma na outra
        melhor = max(((min(parecida(s["descricao"], n["descricao"]), parecida(n["descricao"], s["descricao"])),
                       parecida(s["descricao"], n["descricao"]), s["codigo"]) for s in candidatos), default=(0, 0, None))
        if melhor[0] >= 0.99:
            res[n["codigo"]] = (melhor[2], "descricao", melhor[0])

    linhas = []
    for n in sippes:
        cod, regra, sim = res.get(n["codigo"], (None, "sem_correspondencia", 0))
        linhas.append({"sippes": n["codigo"], "descricao_sippes": n["descricao"], "siappes": cod,
                       "descricao_siappes": por_cod[cod]["descricao"] if cod else None, "regra": regra, "similaridade": round(sim, 2)})
    json.dump(linhas, open(os.path.join(SAIDA, "cruzamento.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    with open(os.path.join(SAIDA, "cruzamento.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0]), delimiter=";")
        w.writeheader()
        w.writerows(linhas)
    cont = {}
    for l in linhas:
        cont[l["regra"]] = cont.get(l["regra"], 0) + 1
    print("SIPPES:", len(linhas), cont)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()
