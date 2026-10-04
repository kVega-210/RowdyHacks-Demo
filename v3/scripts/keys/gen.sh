#!/usr/bin/env sh
# PH-01 signed key IDs + print sheet into data/keys/. Set HEIST_KEY_SECRET first. Args: [--count 8]
exec "$(dirname "$0")/../../run.sh" keys "$@"
