# EduConect Rural — Dockerfile multi-etapa
# Build:      docker build -t educonect-rural .
# Run:        docker run -p 8080:8080 educonect-rural
# Dev:        docker compose up

# ── Builder: Rust ──
FROM rust:1.85-slim-bookworm AS rust-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY edu-conect-rural-server/ .

RUN cargo build --release && strip target/release/edu-conect-rural-server

# ── Builder: Next.js (opcional — falla suave) ──
FROM node:22-slim AS next-builder

WORKDIR /build
COPY edu-conect-rural-dashboard/package.json ./
COPY edu-conect-rural-dashboard/package-lock.json* ./
RUN npm install --ignore-scripts 2>/dev/null || true

COPY edu-conect-rural-dashboard/ .
RUN npm run build 2>/dev/null; echo "Next.js build skipped (optional)"

# ── Runtime final ──
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl ffmpeg espeak-ng yt-dlp libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data/videos /data/contenido/zim /data/biblioteca /data/contenido

COPY --from=rust-builder /build/target/release/edu-conect-rural-server /app/server
COPY --from=rust-builder /build/static/ /app/static/
COPY --from=next-builder /build/out/ /app/frontend/
COPY edu-conect-rural-dashboard/modulos/ /app/modulos/

ENV DB_PATH=/data/educonect.db \
    FRONTEND_PATH=/app/frontend/ \
    LISTEN_ADDR=0.0.0.0:8080 \
    RUST_LOG=info \
    JWT_SECRET=cambiar_en_produccion_con_openssl_rand_base64_64

WORKDIR /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

EXPOSE 8080
ENTRYPOINT ["/app/server"]
