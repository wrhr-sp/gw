FROM node:22.22.1-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/file-processor/package.json apps/file-processor/package.json
RUN pnpm install --frozen-lockfile --filter @werehere/file-processor...
COPY apps/file-processor apps/file-processor
RUN pnpm --filter @werehere/file-processor exec tsc --outDir dist

FROM node:22.22.1-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends clamav clamav-daemon ca-certificates \
  && freshclam \
  && rm -rf /var/lib/apt/lists/* \
  && printf '%s\n' \
    'Foreground false' \
    'TCPSocket 3310' \
    'TCPAddr 127.0.0.1' \
    'MaxFileSize 20M' \
    'MaxScanSize 20M' \
    'StreamMaxLength 20M' \
    'User clamav' \
    'DatabaseDirectory /var/lib/clamav' \
    > /etc/clamav/clamd.conf
WORKDIR /app
COPY --from=build /workspace/apps/file-processor/dist ./dist
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/file-processor/node_modules ./apps/file-processor/node_modules
ENV PORT=8080 CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:8080/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-ec", "clamd && exec node dist/src/index.js"]
