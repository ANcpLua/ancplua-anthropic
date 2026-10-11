#!/bin/sh
# Keep stdin untouched for the verifier when Bun is available.
set -eu
BUN=$(command -v bun || true)
if [ -z "$BUN" ] && [ -n "${BUN_INSTALL:-}" ] && [ -x "$BUN_INSTALL/bin/bun" ]; then
  BUN="$BUN_INSTALL/bin/bun"
fi
if [ -z "$BUN" ] && [ -x "$HOME/.bun/bin/bun" ]; then
  BUN="$HOME/.bun/bin/bun"
fi
if [ -n "$BUN" ]; then
  exec "$BUN" "$(dirname "$0")/stop-verify.mjs" "$@"
fi

# Bun cannot parse the hook input here. Read only the top-level session_id with
# POSIX awk, including JSON string escapes, and sanitize it like stop-verify.mjs.
session=$(awk '
  function string(    c, e, hex, n, j, value) {
    value = ""
    while (++i <= length(json)) {
      c = substr(json, i, 1)
      if (c == "\"") return value
      if (c == "\\") {
        e = substr(json, ++i, 1)
        if (e == "u") {
          hex = tolower(substr(json, i + 1, 4)); i += 4; n = 0
          for (j = 1; j <= 4; j++) n = n * 16 + index("0123456789abcdef", substr(hex, j, 1)) - 1
          c = n > 0 && n < 128 ? sprintf("%c", n) : "_"
        } else c = e ~ /^["\\\/]$/ ? e : "_"
      }
      value = value (c ~ /^[A-Za-z0-9._-]$/ ? c : "_")
    }
    return value
  }
  { json = json $0 "\n" }
  END {
    for (i = 1; i <= length(json); i++) {
      c = substr(json, i, 1)
      if (c == "{" || c == "[") depth++
      else if (c == "}" || c == "]") depth--
      else if (c == "\"") {
        token = string()
        if (depth != 1 || token != "session_id") continue
        rest = substr(json, i + 1)
        if (!match(rest, /^[[:space:]]*:[[:space:]]*"/)) continue
        i += RLENGTH
        value = string()
        print (value == "" ? "no-session" : value)
        exit
      }
    }
    print "no-session"
  }
')
state_dir=${TMPDIR:-${TMP:-${TEMP:-/tmp}}}/ancplua-anthropic-stop-hook
marker="$state_dir/$session.missing-bun"
if [ -d "$marker" ]; then exit 0; fi
if mkdir -p "$state_dir" 2>/dev/null; then
  if ! mkdir "$marker" 2>/dev/null && [ -d "$marker" ]; then exit 0; fi
fi
echo 'ancplua-anthropic Stop hook requires Bun 1.4 or later; install: curl -fsSL https://bun.com/install | bash' >&2
exit 2
