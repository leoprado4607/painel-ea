#!/usr/bin/env bash
# Junta _shared/ipca.ts e coletar-ipca/index.ts num arquivo só (para o editor de funções do painel do Supabase).
cd "$(dirname "$0")/../../supabase/functions" || exit 1
{ echo "// Versão em arquivo único de coletar-ipca (para colar no editor do painel do Supabase)."
  echo "// Gerado por tools/supabase/empacotar-funcao.sh a partir de _shared/ipca.ts e coletar-ipca/index.ts."
  echo
  grep -v '^import { buscarSerie' coletar-ipca/index.ts | sed '/^\/\/ Edge Function/,$!d'
  echo
  echo "// ---------------------------------------------------------------- _shared/ipca.ts"
  cat _shared/ipca.ts
} > ../../tools/supabase/coletar-ipca.bundle.ts
