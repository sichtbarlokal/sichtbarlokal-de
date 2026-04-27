#!/bin/bash
# Doppelklick in Finder oeffnet diese Datei im Terminal und committet/pusht.
# Vor dem ersten Lauf einmal: chmod +x deploy.command
set -e
cd "$(dirname "$0")"

echo ""
echo "==> Aktueller Status:"
git status -s
echo ""
read -p "Commit-Nachricht (Enter fuer Default): " MSG
MSG=${MSG:-"feat(tool): echte Google-Daten via Netlify Function, Affiliate-Block, 47EUR-Report"}

git add .
git commit -m "$MSG" || echo "(nichts zu committen)"
git push origin main
echo ""
echo "==> Push fertig. Netlify deployt jetzt automatisch."
echo "    Live in ca. 60 s unter https://sichtbarlokal.de"
echo ""
read -p "Druecke Enter zum Schliessen ..."
