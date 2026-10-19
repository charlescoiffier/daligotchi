#!/bin/sh
# Postgres local propre au projet (dossier .data/, port 5434, accès local sans mot de passe).
# Nécessite les outils Postgres (Homebrew : brew install postgresql@17).
set -e

DATA_DIR=".data/postgres"
PORT=5434
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

case "$1" in
  init)
    if [ -d "$DATA_DIR" ]; then
      echo "Déjà initialisé ($DATA_DIR)."
    else
      initdb -D "$DATA_DIR" -U daligotchi --auth=trust -E UTF8 --locale=C >/dev/null
      echo "Postgres initialisé dans $DATA_DIR."
    fi
    sh "$0" start
    createdb -h localhost -p $PORT -U daligotchi daligotchi_dev 2>/dev/null || true
    createdb -h localhost -p $PORT -U daligotchi daligotchi_test 2>/dev/null || true
    echo "Bases daligotchi_dev et daligotchi_test prêtes."
    ;;
  start)
    if pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; then
      echo "Postgres tourne déjà (port $PORT)."
    else
      pg_ctl -D "$DATA_DIR" -o "-p $PORT -k /tmp -c listen_addresses=localhost" -l .data/postgres.log -w start
    fi
    ;;
  stop)
    pg_ctl -D "$DATA_DIR" -w stop
    ;;
  *)
    echo "Usage : $0 init|start|stop" >&2
    exit 1
    ;;
esac
