#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  clamav clamav-daemon
sudo systemctl stop clamav-freshclam.service 2>/dev/null || true
sudo freshclam --quiet

config_file="$(mktemp)"
self_test_log="$(mktemp)"
cleanup() {
  rm -f "$config_file" "$self_test_log"
}
trap cleanup EXIT
chmod 600 "$config_file"
printf '%s\n' \
  'DatabaseDirectory /var/lib/clamav' \
  'TCPSocket 3310' \
  'TCPAddr 127.0.0.1' \
  'Foreground false' \
  'User clamav' \
  'MaxFileSize 20M' \
  'MaxScanSize 20M' \
  'StreamMaxLength 20M' \
  > "$config_file"
sudo clamd --config-file="$config_file"

for _ in $(seq 1 30); do
  if pnpm --filter @werehere/file-processor self-test:clamav \
    > "$self_test_log" 2>&1; then
    grep -qx 'FILE_PROCESSOR_CLAMAV_SELF_TEST_OK' "$self_test_log"
    printf '%s\n' 'PREVIEW_FILE_SCANNER_CLAMAV_READY'
    printf '%s\n' 'FILE_PROCESSOR_CLAMAV_SELF_TEST_OK'
    exit 0
  fi
  sleep 1
done
printf '%s\n' 'PREVIEW_FILE_SCANNER_CLAMAV_UNAVAILABLE' >&2
exit 1
