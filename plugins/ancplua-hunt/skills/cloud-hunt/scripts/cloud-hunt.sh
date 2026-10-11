#!/bin/sh
# Wrapper for cloud-hunt.mjs.
# - Makes sure the plugin's pinned packages are installed, as hunt.sh does.
# - Reads ANTHROPIC_API_KEY from the macOS keychain when it isn't already set, without printing
#   it. The hunt's spend goes to the account that owns that key: API credits, not a subscription.
# Settings come from the environment or from ~/.ancplua-hunt/config (KEY=VALUE lines), shared
# with the local hunt:
#   ANCPLUA_HUNT_KEYCHAIN_SERVICE  keychain service name (default anthropic-api-key)
#   ANCPLUA_HUNT_KEYCHAIN_ACCOUNT  keychain account name (optional)
#   ANCPLUA_HUNT_CAP               total spend cap in USD (default 100)
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PLUGIN_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
HUNT_HOME=${ANCPLUA_HUNT_HOME:-$HOME/.ancplua-hunt}

CONF="$HUNT_HOME/config"
if [ -f "$CONF" ]; then
  while IFS='=' read -r key value || [ -n "$key" ]; do
    case "$key" in
      ANCPLUA_HUNT_KEYCHAIN_SERVICE|ANCPLUA_HUNT_KEYCHAIN_ACCOUNT|ANCPLUA_HUNT_CAP)
        # The environment wins over the file.
        eval "current=\${$key:-}"
        if [ -z "$current" ]; then export "$key=$value"; fi
        ;;
    esac
  done < "$CONF"
fi

if [ ! -d "$PLUGIN_ROOT/node_modules/yaml" ]; then
  echo "ancplua-hunt: installing the pinned packages (first run only)" >&2
  (cd "$PLUGIN_ROOT" && bun install --frozen-lockfile --ignore-scripts --silent >&2)
fi

case " $* " in
  *" --dry-run "*|*" --ledger "*|*" --help "*|*" -h "*) ;;
  *)
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
      service=${ANCPLUA_HUNT_KEYCHAIN_SERVICE:-anthropic-api-key}
      if [ -n "${ANCPLUA_HUNT_KEYCHAIN_ACCOUNT:-}" ]; then
        key=$(security find-generic-password -s "$service" -a "$ANCPLUA_HUNT_KEYCHAIN_ACCOUNT" -w 2>/dev/null) || key=""
      else
        key=$(security find-generic-password -s "$service" -w 2>/dev/null) || key=""
      fi
      if [ -z "$key" ]; then
        echo "ERROR cloud-hunt: set ANTHROPIC_API_KEY, or store the key in the macOS keychain under service \"$service\" (set ANCPLUA_HUNT_KEYCHAIN_ACCOUNT if several keys share it)" >&2
        exit 2
      fi
      ANTHROPIC_API_KEY=$key
      export ANTHROPIC_API_KEY
    fi
    ;;
esac

exec bun "$SCRIPT_DIR/cloud-hunt.mjs" "$@"
