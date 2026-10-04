#!/usr/bin/env sh
# TL-01 protocol bots. Example: scripts/bots/run.sh --room ABCD --count 6 [--success 0.7] [--spam] [--scale 1]. No --room = create a room and start it.
exec "$(dirname "$0")/../../run.sh" bots "$@"
