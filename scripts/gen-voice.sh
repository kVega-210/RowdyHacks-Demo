#!/usr/bin/env sh
# AU-02 ElevenLabs batch generation into client/host/audio/. Needs ELEVENLABS_API_KEY. Args: [--dry-run]
exec "$(dirname "$0")/../run.sh" gen-voice "$@"
