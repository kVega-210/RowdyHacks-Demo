#!/usr/bin/env sh
# Lint (OPS-01): Java compiles with -Xlint, the DOC-03 module contract test runs, and every client JS file
# parses (node --check, if Node is installed). ESLint runs too when available.
set -e
cd "$(dirname "$0")/.."
(cd server && ./mvnw -q -B -Dtest='ModuleContractTest,ContentTest' test)
if command -v node >/dev/null 2>&1; then
  find client shared dev -name '*.js' | while read -r f; do node --check --input-type=module < "$f" || { echo "syntax error in $f"; exit 1; }; done
  if command -v eslint >/dev/null 2>&1; then eslint --no-config-lookup --rule '{"no-undef":"off","no-unused-vars":"warn"}' --global window,document client shared || true; fi
fi
echo "lint ok"
