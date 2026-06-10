#!/usr/bin/env bash
set -euo pipefail

python3 - "$@" <<'PY'
from __future__ import annotations

import argparse
import ipaddress
import json
import socket
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from urllib.parse import urlencode, urlparse

@dataclass
class CheckResult:
    name: str
    url: str
    status: str
    http_status: int | None = None
    message: str = ""
    elapsed_ms: int | None = None


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="그룹웨어 배포 smoke check. 읽기 요청만 수행하며 배포/롤백/설정 변경은 하지 않습니다.",
    )
    p.add_argument("--web-url", default=os.environ.get("CLOUDFLARE_WEB_URL", ""), help="Web base URL. 없으면 CLOUDFLARE_WEB_URL 사용")
    p.add_argument("--api-url", default=os.environ.get("CLOUDFLARE_API_URL", ""), help="API base URL. 없으면 CLOUDFLARE_API_URL 사용")
    p.add_argument("--property-id", help="샘플 숙소 ID. 없으면 상세/availability는 SKIP")
    p.add_argument("--check-availability", action="store_true", help="property-id가 있을 때 availability API도 확인")
    p.add_argument("--timeout", type=float, default=20.0, help="요청별 timeout 초")
    p.add_argument("--retries", type=int, default=2, help="실패 시 추가 재시도 횟수")
    p.add_argument("--allow-private", action="store_true", help="localhost/private/metadata 대역 URL도 명시적으로 허용")
    p.add_argument("--strict", action="store_true", help="SKIP도 실패로 간주")
    p.add_argument("--json", action="store_true", help="JSON 출력")
    p.add_argument("--preview", action="store_true", help="요청 목록만 보여주고 실행하지 않음")
    return p


def clean_base(url: str) -> str:
    return url.rstrip("/")


def is_privateish_ip(value: ipaddress._BaseAddress) -> bool:
    return any([
        value.is_private,
        value.is_loopback,
        value.is_link_local,
        value.is_reserved,
        value.is_multicast,
        value.is_unspecified,
    ])


def validate_base_url(label: str, raw_url: str, allow_private: bool) -> tuple[str, str]:
    if not raw_url or not raw_url.strip():
        raise ValueError(f"{label}: URL을 명시하거나 CLOUDFLARE_WEB_URL/CLOUDFLARE_API_URL 환경변수를 설정하세요")
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"{label}: http/https URL만 허용됩니다")
    if not parsed.netloc or not parsed.hostname:
        raise ValueError(f"{label}: 호스트가 있는 완전한 URL이 필요합니다")

    hostname = parsed.hostname
    lowered = hostname.lower()
    private_hostnames = {
        "localhost",
        "localhost.localdomain",
        "metadata",
        "metadata.google.internal",
    }
    if lowered in private_hostnames or lowered.endswith(".local"):
        if not allow_private:
            raise ValueError(f"{label}: localhost/private/metadata 계열 호스트는 기본 차단됩니다. 정말 필요하면 --allow-private를 사용하세요")

    try:
        literal_ip = ipaddress.ip_address(hostname)
    except ValueError:
        literal_ip = None

    flagged_ips: list[str] = []
    if literal_ip is not None:
        if is_privateish_ip(literal_ip):
            flagged_ips.append(str(literal_ip))
    else:
        try:
            infos = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        except socket.gaierror:
            infos = []
        for info in infos:
            addr = info[4][0]
            try:
                resolved = ipaddress.ip_address(addr)
            except ValueError:
                continue
            if is_privateish_ip(resolved):
                flagged_ips.append(str(resolved))

    if flagged_ips and not allow_private:
        preview = ", ".join(sorted(set(flagged_ips))[:4])
        raise ValueError(f"{label}: private/loopback/link-local/reserved IP로 해석됩니다 ({preview}). 정말 필요하면 --allow-private를 사용하세요")

    return label, clean_base(raw_url)


def request_once(name: str, url: str, timeout: float) -> CheckResult:
    start = time.monotonic()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "gw-deploy-smoke-check/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read(300).decode("utf-8", "replace")
            elapsed = int((time.monotonic() - start) * 1000)
            if 200 <= response.status < 400:
                return CheckResult(name, url, "PASS", response.status, body.replace("\n", " ")[:160], elapsed)
            return CheckResult(name, url, "FAIL", response.status, f"HTTP {response.status}", elapsed)
    except urllib.error.HTTPError as exc:
        elapsed = int((time.monotonic() - start) * 1000)
        return CheckResult(name, url, "FAIL", exc.code, f"HTTPError {exc.code}", elapsed)
    except Exception as exc:  # noqa: BLE001 - CLI diagnostics
        elapsed = int((time.monotonic() - start) * 1000)
        return CheckResult(name, url, "FAIL", None, f"{type(exc).__name__}: {exc}", elapsed)


def check_with_retries(name: str, url: str, timeout: float, retries: int) -> CheckResult:
    last = request_once(name, url, timeout)
    for _ in range(max(0, retries)):
        if last.status == "PASS":
            return last
        time.sleep(2)
        last = request_once(name, url, timeout)
    return last


def main() -> int:
    args = build_parser().parse_args()
    try:
        _, web = validate_base_url("--web-url", args.web_url, args.allow_private)
        _, api = validate_base_url("--api-url", args.api_url, args.allow_private)
    except ValueError as exc:
        if args.json:
            print(json.dumps({"ok": False, "error": str(exc), "results": []}, ensure_ascii=False, indent=2))
        else:
            print(f"입력 차단: {exc}", file=sys.stderr)
        return 2
    checks: list[tuple[str, str, bool]] = [
        ("web-root", f"{web}/", True),
        ("web-properties", f"{web}/properties", True),
        ("web-api-health", f"{web}/api/health", True),
        ("api-health", f"{api}/health", True),
    ]
    if args.property_id:
        checks.append(("web-property-detail", f"{web}/properties/{args.property_id}", True))
        if args.check_availability:
            query = urlencode({"checkInDate": "2026-07-01", "checkOutDate": "2026-07-03", "guests": "2"})
            checks.append(("web-property-availability", f"{web}/api/properties/{args.property_id}/availability?{query}", True))
    else:
        checks.append(("web-property-detail", "property-id 없음", False))
        if args.check_availability:
            checks.append(("web-property-availability", "property-id 없음", False))

    if args.preview:
        results = [CheckResult(name, url, "WOULD_CHECK" if active else "SKIP", message="preview") for name, url, active in checks]
    else:
        results = []
        for name, url, active in checks:
            if not active:
                results.append(CheckResult(name, url, "SKIP", message="--property-id가 없어 건너뜀"))
                continue
            results.append(check_with_retries(name, url, args.timeout, args.retries))

    failed = [r for r in results if r.status == "FAIL"]
    skipped = [r for r in results if r.status == "SKIP"]
    ok = not failed and (not args.strict or not skipped)
    if args.json:
        print(json.dumps({"ok": ok, "results": [asdict(r) for r in results]}, ensure_ascii=False, indent=2))
    else:
        for r in results:
            http = f" HTTP {r.http_status}" if r.http_status is not None else ""
            elapsed = f" {r.elapsed_ms}ms" if r.elapsed_ms is not None else ""
            print(f"[{r.status}] {r.name}: {r.url}{http}{elapsed}")
            if r.message:
                print(f"  - {r.message}")
        print(f"요약: {'PASS' if ok else 'FAIL'} ({len(failed)} fail, {len(skipped)} skip)")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
PY
