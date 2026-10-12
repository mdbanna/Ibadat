#!/usr/bin/env bash
[ -f /tmp/ibadat-backend.pids ] && while read -r p; do kill "$p" 2>/dev/null || true; done < /tmp/ibadat-backend.pids; rm -f /tmp/ibadat-backend.pids; echo stopped
