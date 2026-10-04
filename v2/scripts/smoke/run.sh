#!/usr/bin/env sh
# IF-04 end-to-end smoke test: in-process server, 6 bots, full game, asserts bank never negative, one winner, event log. Args: [--scale 20] [--bots 6]
exec "$(dirname "$0")/../../run.sh" smoke "$@"
