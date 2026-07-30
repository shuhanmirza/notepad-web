#!/bin/sh

set -eu

env_file="${ENV_FILE:-.env}"

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file. Copy .env.example to .env first." >&2
  exit 1
fi

publish_host_port="$(
  awk -F= '
    /^[[:space:]]*PUBLISH_HOST_PORT[[:space:]]*=/ {
      value = $2
    }
    END {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      print tolower(value)
    }
  ' "$env_file"
)"

case "$publish_host_port" in
  true | 1 | yes)
    exec docker compose \
      --env-file "$env_file" \
      -f docker-compose.yml \
      -f docker-compose.dev.yml \
      "$@"
    ;;
  false | 0 | no | "")
    exec docker compose \
      --env-file "$env_file" \
      -f docker-compose.yml \
      "$@"
    ;;
  *)
    echo "PUBLISH_HOST_PORT must be true or false in $env_file." >&2
    exit 2
    ;;
esac
