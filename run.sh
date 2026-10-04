#!/usr/bin/env sh
# One command dev start (OPS-01): builds the server if needed and serves the host + phone clients.
#   ./run.sh                 start the game server (http://localhost:7070)
#   ./run.sh test            run unit tests + the end-to-end smoke test
#   ./run.sh bots|smoke|keys|gen-voice [args]   tools, see README
set -e
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export HEIST_ROOT="$(pwd)"
JAR=server/target/heist-server.jar
build() { (cd server && ./mvnw -q -B -DskipTests package); }
case "$1" in
  test) (cd server && ./mvnw -B test); exit $? ;;
  lint) sh scripts/lint.sh; exit $? ;;
  build) build; exit 0 ;;
esac
if [ ! -f "$JAR" ] || [ -n "$(find server/src server/pom.xml -newer "$JAR" -type f 2>/dev/null | head -1)" ]; then
  echo "Building server..."
  build
fi
exec java -jar "$JAR" "$@"
