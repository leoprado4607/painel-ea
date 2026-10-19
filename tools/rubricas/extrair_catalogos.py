"""Extrai os catálogos de rubricas:
  - SIAPPES (sistema antigo, códigos da planilha como A01, Z01): seção 7 da "Listagem da Tabela de Pagamento" (Tab_pag_*.txt)
  - SIPPES (sistema atual, códigos NR0001, ND0001): "Relação de Rubricas Disponíveis para Mil da Ativa" (PDF)
e grava tools/rubricas/saida/{siappes,sippes}.json.

Uso: python extrair_catalogos.py <Tab_pag.txt> <Rubricas SIPPES.pdf>
"""
import json
import os
import re
import sys

import pdfplumber

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "saida")


def siappes(caminho):
    """Linhas da seção 7: '0  7   1  A01  SOLDO  00  1  0  31901201  1  1  0A  09/02/15'."""
    linha_re = re.compile(
        r"^0?\s+7\s+(?P<cat>\d)\s+(?P<cod>[A-Z0-9]{3})\s+(?P<desc>.+?)\s{2,}(?P<pz>\d{2})\s+(?P<st>\d)\s+(?P<c66>\d)\s+"
        r"(?P<iorc>\d{8})\s+(?P<clfm>\d)\s+(?P<s13>\d)\s+(?P<tcod>\w{2})\s+(?P<ult>\d{2}/\d{2}/\d{2})")
    itens, dentro = {}, False
    with open(caminho, encoding="cp850", errors="replace") as f:
        for l in f:
            if "SECAO 7 -" in l:
                dentro = True
            if not dentro:
                continue
            m = linha_re.match(l.rstrip())
            if m:
                itens[m["cod"]] = {
                    "codigo": m["cod"], "categoria": int(m["cat"]), "descricao": m["desc"].strip(),
                    "natureza_despesa": m["iorc"], "prazo": m["pz"], "atualizado": m["ult"],
                }
    return list(itens.values())


def sippes(caminho):
    """Tabela '# CÓDIGO DESCRICAO ABREVIADA FINALIDADE'; descrição e finalidade podem quebrar linha."""
    itens = []
    with pdfplumber.open(caminho) as pdf:
        for p in pdf.pages:
            palavras = p.extract_words(keep_blank_chars=False, use_text_flow=False)
            cab = [w for w in palavras if w["text"] in ("DESCRICAO", "ABREVIADA", "FINALIDADE")]
            if len({w["text"] for w in cab}) < 3:
                continue
            x_desc = min(w["x0"] for w in cab if w["text"] == "DESCRICAO") - 6
            # a descrição abreviada é centralizada sob "DESCRICAO ABREVIADA": termina pouco depois do fim do título
            x_fin = max(w["x1"] for w in cab if w["text"] == "ABREVIADA") + 6
            topo_tab = max(w["bottom"] for w in cab)
            codigos = sorted([w for w in palavras if re.fullmatch(r"(NR|ND|AR|AD)\d{4}", w["text"]) and w["top"] > topo_tab],
                             key=lambda w: w["top"])
            if codigos:  # a descrição começa logo depois da coluna de código
                x_desc = max(w["x1"] for w in codigos) + 1
            # Descrição: linhas da coluna "DESCRICAO ABREVIADA", centralizadas na altura do código
            # (k linhas acima e k abaixo). Resolve em sequência quais linhas vão para cada código.
            col = [w for w in palavras if x_desc <= w["x0"] < x_fin and w["top"] > topo_tab
                   and not re.fullmatch(r"(NR|ND|AR|AD)\d{4}", w["text"])]
            linhas = []
            for w in sorted(col, key=lambda w: (w["top"], w["x0"])):
                if linhas and abs(linhas[-1]["top"] - w["top"]) < 3:
                    linhas[-1]["palavras"].append(w)
                else:
                    linhas.append({"top": w["top"], "palavras": [w]})
            def texto(l):
                return " ".join(w["text"] for w in sorted(l["palavras"], key=lambda w: w["x0"]))
            na_linha = {id(c): [l for l in linhas if abs(l["top"] - c["top"]) < 3] for c in codigos}
            soltas = [l for l in linhas if not any(abs(l["top"] - c["top"]) < 3 for c in codigos)]
            k = 0
            acima, abaixo = {}, {}
            for n, c in enumerate(codigos):
                ini = codigos[n - 1]["top"] if n else topo_tab
                entre = [l for l in soltas if ini < l["top"] < c["top"]]
                if n:
                    usar = min(k, len(entre))
                    abaixo[id(codigos[n - 1])] = entre[:usar]
                    acima[id(c)] = entre[usar:]
                else:
                    acima[id(c)] = entre
                k = len(acima[id(c)])
            if codigos:
                ult = codigos[-1]
                abaixo[id(ult)] = [l for l in soltas if l["top"] > ult["top"]][:k]
            for c in codigos:
                partes = acima.get(id(c), []) + na_linha[id(c)] + abaixo.get(id(c), [])
                desc = " ".join(texto(l) for l in partes)
                fin = " ".join(w["text"] for w in sorted([w for w in palavras if w["x0"] >= x_fin and abs(w["top"] - c["top"]) < 30],
                                                          key=lambda w: (round(w["top"]), w["x0"])))
                itens.append({"codigo": c["text"], "descricao": re.sub(r"\s+", " ", desc).strip(),
                              "finalidade": re.sub(r"\s+", " ", fin).strip()})
    unicos = {}
    for it in itens:
        unicos.setdefault(it["codigo"], it)
    return list(unicos.values())


def main():
    os.makedirs(SAIDA, exist_ok=True)
    a = siappes(sys.argv[1])
    b = sippes(sys.argv[2])
    for nome, dados in (("siappes", a), ("sippes", b)):
        with open(os.path.join(SAIDA, f"{nome}.json"), "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=1)
    print("SIAPPES:", len(a), "códigos | SIPPES:", len(b), "códigos")


if __name__ == "__main__":
    main()
