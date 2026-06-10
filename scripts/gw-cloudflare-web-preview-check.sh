#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/web"
PREVIEW_PORT="${CLOUDFLARE_WEB_PREVIEW_PORT:-8788}"
MOCK_API_PORT="${CLOUDFLARE_WEB_MOCK_API_PORT:-4100}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${MOCK_API_PORT}}"
MOCK_API_HOST="127.0.0.1"
TMP_DIR="$(mktemp -d)"
MOCK_API_SCRIPT="$TMP_DIR/mock-api.py"
MOCK_API_LOG="$TMP_DIR/mock-api.log"
PREVIEW_LOG="$TMP_DIR/wrangler.log"
MOCK_API_PID=""
PREVIEW_PID=""

cleanup() {
  if [[ -n "$PREVIEW_PID" ]] && kill -0 "$PREVIEW_PID" 2>/dev/null; then
    kill "$PREVIEW_PID" 2>/dev/null || true
    wait "$PREVIEW_PID" 2>/dev/null || true
  fi

  if [[ -n "$MOCK_API_PID" ]] && kill -0 "$MOCK_API_PID" 2>/dev/null; then
    kill "$MOCK_API_PID" 2>/dev/null || true
    wait "$MOCK_API_PID" 2>/dev/null || true
  fi

  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cat > "$MOCK_API_SCRIPT" <<'PY'
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PROPERTY = {
    "id": "prop-seoul-stay",
    "slug": "seoul-stay",
    "name": "서울 스테이 시청",
    "city": "서울",
    "address": "서울시 중구 세종대로 1",
    "description": "Cloudflare preview용 mock 숙소",
    "region": "중구",
    "checkInTime": "15:00",
    "checkOutTime": "11:00",
    "roomTypes": [
        {
            "id": "room-deluxe",
            "name": "디럭스 더블",
            "description": "도심 전망 객실",
            "baseOccupancy": 2,
            "maxOccupancy": 4,
            "totalRooms": 3,
        }
    ],
}

PROPERTY_LIST_ITEM = {
    "id": PROPERTY["id"],
    "name": PROPERTY["name"],
    "city": PROPERTY["city"],
    "address": PROPERTY["address"],
    "description": PROPERTY["description"],
    "roomTypeSummary": {
        "roomTypeCount": len(PROPERTY["roomTypes"]),
        "maxGuestCapacity": max(room["maxOccupancy"] for room in PROPERTY["roomTypes"]),
    },
}

class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args) -> None:
        return

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/health":
            self._send(200, {"status": "ok", "runtime": "mock-api"})
            return

        if path == "/properties":
            self._send(
                200,
                {
                    "items": [PROPERTY_LIST_ITEM],
                    "meta": {
                        "city": query.get("city", [None])[0],
                        "guests": query.get("guests", [None])[0],
                        "count": 1,
                    },
                },
            )
            return

        if path == f"/properties/{PROPERTY['id']}":
            self._send(200, PROPERTY)
            return

        if path == f"/properties/{PROPERTY['id']}/availability":
            self._send(
                200,
                {
                    "propertyId": PROPERTY["id"],
                    "checkInDate": query.get("checkInDate", [""])[0],
                    "checkOutDate": query.get("checkOutDate", [""])[0],
                    "guests": int(query.get("guests", ["2"])[0]),
                    "roomTypes": [
                        {
                            "roomTypeId": "room-deluxe",
                            "roomTypeName": "디럭스 더블",
                            "baseOccupancy": 2,
                            "maxOccupancy": 4,
                            "isAvailable": True,
                            "available": 3,
                            "totalPrice": 129000,
                            "currency": "KRW",
                        }
                    ],
                    "nights": 1,
                },
            )
            return

        self._send(404, {"message": "Not Found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/reservations":
            self._send(404, {"message": "Not Found"})
            return

        length = int(self.headers.get("content-length", "0"))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"
        payload = json.loads(raw_body.decode("utf-8") or "{}")

        self._send(
            201,
            {
                "id": "reservation-preview-1",
                "status": "confirmed",
                "propertyId": payload.get("propertyId", PROPERTY["id"]),
                "roomTypeId": payload.get("roomTypeId", "room-deluxe"),
            },
        )

if __name__ == "__main__":
    import os

    port = int(os.environ.get("MOCK_API_PORT", "4100"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.serve_forever()
PY

MOCK_API_PORT="$MOCK_API_PORT" python3 "$MOCK_API_SCRIPT" > "$MOCK_API_LOG" 2>&1 &
MOCK_API_PID=$!

(
  cd "$APP_DIR"
  API_BASE_URL="$API_BASE_URL" ENABLE_TEST_AUTH=true TEST_CUSTOMER_USER_ID=user-customer-seed TEST_CUSTOMER_USER_ROLE=customer pnpm cf:build
) >/dev/null

(
  cd "$APP_DIR"
  API_BASE_URL="$API_BASE_URL" ENABLE_TEST_AUTH=true TEST_CUSTOMER_USER_ID=user-customer-seed TEST_CUSTOMER_USER_ROLE=customer pnpm cf:preview
) > "$PREVIEW_LOG" 2>&1 &
PREVIEW_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/" | grep -q "그룹웨어 MVP Bootstrap"
curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/properties?city=%EC%84%9C%EC%9A%B8&guests=2" | grep -q "검색 결과"
curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/api/health" | grep -q '"ok":true'
curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/api/properties" | grep -q '"items"'
curl -fsS "http://127.0.0.1:${PREVIEW_PORT}/api/properties/prop-seoul-stay/availability?checkInDate=2026-07-01&checkOutDate=2026-07-02&guests=2" | grep -q '"available":3'

echo "Cloudflare preview check passed"
echo "- build: pnpm --filter web cf:build"
echo "- preview: API_BASE_URL=${API_BASE_URL} ENABLE_TEST_AUTH=true pnpm --filter web cf:preview"
echo "- verified routes: /, /properties, /api/health, /api/properties, /api/properties/[propertyId]/availability"
