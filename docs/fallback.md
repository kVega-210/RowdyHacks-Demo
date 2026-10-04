# Fallback plan (DEMO-03)

Built: **offline bot lobby**. The host's "Fill with bots" adds server-side bots that play the whole game, so a
single laptop with no internet can demo everything (`./run.sh`, open `/host/`, fill, start). Everything degrades
gracefully without network APIs (narrator -> Web Speech, roast -> templates, DB -> JSONL).

Human to-do: record a 60s gameplay video (screen capture of `/host/` + one phone), pack 2 spare phones, a hotspot,
the printed keys/cards, a power strip.
