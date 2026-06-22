const GW_REFRESH_BYPASS_HEADER = "x-gw-refresh-preload";
const GW_REFRESH_VISIBLE_MS = 900;
const GW_REFRESH_PRELOAD_TIMEOUT_MS = 4200;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function shouldShowRefreshPage(request) {
  if (request.method !== "GET" || request.mode !== "navigate") {
    return false;
  }
  if (request.headers.get(GW_REFRESH_BYPASS_HEADER) === "1") {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }
  if (url.pathname === "/refresh" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return false;
  }

  return request.cache === "reload" || request.cache === "no-cache";
}

function createRefreshResponse(returnUrl) {
  const safeReturnUrl = JSON.stringify(returnUrl);
  const preloadHeaderName = JSON.stringify(GW_REFRESH_BYPASS_HEADER);
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>새로고침 중</title>
  <style>
    :root { color-scheme: light; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; overscroll-behavior: none; }
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
    .refresh-page { display: grid; width: 100vw; height: 100dvh; min-height: 100dvh; overflow: hidden; place-items: center; padding: clamp(12px, 3.2vmin, 24px); box-sizing: border-box; background: radial-gradient(circle at 50% 22%, rgba(219, 234, 254, .9), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); }
    .refresh-page__card { display: grid; justify-items: center; gap: clamp(8px, 2.4vmin, 18px); max-height: calc(100dvh - clamp(24px, 6.4vmin, 48px)); color: #0f172a; }
    .refresh-page__flag { position: relative; display: grid; place-items: center; width: min(840px, calc(100vw - 32px)); height: clamp(104px, 24vmin, 236px); max-height: calc(100dvh - 84px); perspective: 920px; }
    .refresh-page__flag-word { display: inline-flex; align-items: center; justify-content: center; color: #2f5fb8; font-size: clamp(3.4rem, 14vmin, 8.4rem); font-weight: 950; letter-spacing: -0.12em; line-height: .86; transform-origin: 0% 50%; animation: refresh-logo-flag-sway 1.35s ease-in-out infinite; }
    .refresh-page__flag-letter { display: inline-block; transform-origin: 50% 72%; animation: refresh-logo-letter-wave 1.35s ease-in-out infinite; animation-delay: calc(var(--wave-index) * -75ms); }
    .refresh-page__card p { margin: 0; color: #475569; font-size: .96rem; font-weight: 800; letter-spacing: .08em; }
    @keyframes refresh-logo-flag-sway { 0%, 100% { transform: rotateY(-14deg) skewY(-1.5deg) translateX(-5px); filter: brightness(.98); } 50% { transform: rotateY(11deg) skewY(2.2deg) translateX(6px); filter: brightness(1.08); } }
    @keyframes refresh-logo-letter-wave { 0%, 100% { transform: translateY(0) rotateZ(-1deg) scaleX(.98); } 35% { transform: translateY(-17px) rotateZ(2deg) scaleX(1.08); } 70% { transform: translateY(13px) rotateZ(-2deg) scaleX(.95); } }
  </style>
</head>
<body>
  <main class="refresh-page" aria-label="새로고침 중">
    <section class="refresh-page__card" role="status" aria-live="polite">
      <div class="refresh-page__flag" aria-label="WE’REHERE">
        <span class="refresh-page__flag-word" aria-hidden="true">
          <span class="refresh-page__flag-letter" style="--wave-index:0">W</span><span class="refresh-page__flag-letter" style="--wave-index:1">E</span><span class="refresh-page__flag-letter" style="--wave-index:2">’</span><span class="refresh-page__flag-letter" style="--wave-index:3">R</span><span class="refresh-page__flag-letter" style="--wave-index:4">E</span><span class="refresh-page__flag-letter" style="--wave-index:5">H</span><span class="refresh-page__flag-letter" style="--wave-index:6">E</span><span class="refresh-page__flag-letter" style="--wave-index:7">R</span><span class="refresh-page__flag-letter" style="--wave-index:8">E</span>
        </span>
      </div>
      <p>새로고침 중</p>
    </section>
  </main>
  <script>
    (function () {
      var returnUrl = ${safeReturnUrl};
      var preloadHeaderName = ${preloadHeaderName};
      var minimumDelay = new Promise(function (resolve) { window.setTimeout(resolve, ${GW_REFRESH_VISIBLE_MS}); });
      var loadFreshDocument = (async function () {
        var controller = new AbortController();
        var timeout = window.setTimeout(function () { controller.abort(); }, ${GW_REFRESH_PRELOAD_TIMEOUT_MS});
        try {
          var response = await fetch(returnUrl, {
            cache: "reload",
            credentials: "same-origin",
            headers: { [preloadHeaderName]: "1" },
            signal: controller.signal
          });
          if (!response.ok) {
            throw new Error("새로고침 문서 요청 실패");
          }
          var html = await response.text();
          return html;
        } catch (error) {
          return null;
        } finally {
          window.clearTimeout(timeout);
        }
      })();
      Promise.all([minimumDelay, loadFreshDocument]).then(function (results) {
        var freshHtml = results[1];
        if (freshHtml) {
          document.open("text/html", "replace");
          document.write(freshHtml);
          document.close();
          return;
        }
        window.location.reload();
      });
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

self.addEventListener("fetch", (event) => {
  if (!shouldShowRefreshPage(event.request)) {
    return;
  }

  event.respondWith(createRefreshResponse(event.request.url));
});
