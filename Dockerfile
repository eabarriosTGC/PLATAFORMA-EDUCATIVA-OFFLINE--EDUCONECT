# EduConect Rural — Dockerfile multi-etapa con DOS perfiles de distribución.
#
# Los perfiles son targets con nombre, no variables: Docker sólo construye las
# etapas que el target necesita, así que la diferencia entre perfiles queda
# declarada en el grafo de dependencias y no en un condicional que nadie audita.
#
#   core — binario compilado SIN la feature `zim`. Sin cadena nativa de ZIM y sin
#          ningún archivo .zim en la imagen. Las rutas /zim y /api/wikipedia/*
#          siguen registradas y responden 503 canónico: el contrato de
#          degradación es el mismo de siempre.
#   full — binario compilado CON `--features zim` y con las bibliotecas nativas
#          del lector (libzim, libxapian, libicu). El contenido ZIM entra SÓLO
#          por montaje externo en /data/contenido/zim: la imagen no trae, no
#          descarga y no embebe contenido.
#
# Grafo de etapas:
#
#   rust-builder ─┬─ binario-core ──┐
#                 └─ binario-full ──┴─ runtime-base ─┬─ core
#                                                     └─ full
#
# Build:
#   docker build --target core -t educonect-rural:core .
#   docker build --target full -t educonect-rural:full .
# Run:
#   docker run -p 8080:8080 educonect-rural:core
#   docker run -p 8080:8080 -v /srv/zim:/data/contenido/zim:ro educonect-rural:full
#
# El orden de las etapas finales importa: `core` va última para que un
# `docker build .` sin `--target` siga produciendo el artefacto sin ZIM, como
# antes de D-05a.
#
# Requiere BuildKit (el constructor por defecto de Docker): sólo BuildKit omite
# las etapas que el target no necesita. El constructor clásico compila TODAS
# las etapas en cada build, así que `--target core` también compilaría el
# binario con ZIM; la imagen resultante sería la correcta, pero el aislamiento
# que justifica los targets no se materializaría. Con BuildKit:
#   DOCKER_BUILDKIT=1 docker build --target core ...

# ── Compilación compartida: toolchain, dependencias y fuentes ──
FROM rust:1.88-slim-bookworm AS rust-builder

# libzim-dev aporta también libxapian-dev y libicu-dev: las necesita
# zim-sys/build.rs (`pkg_config::probe_library("libzim")`) para COMPILAR la
# feature `zim`. Su presencia en el builder no enlaza nada: el perfil `core`
# compila sin la feature y su binario no arrastra la cadena.
# La imagen base de Rust no trae `strip`; g++ sí arrastra binutils.
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev g++ libzim-dev && rm -rf /var/lib/apt/lists/*

# Compilación acotada: el objetivo son máquinas modestas (Raspberry Pi) y un
# builder sin límite agota la RAM con 18 jobs de rustc durante el LTO.
ENV CARGO_BUILD_JOBS=4

WORKDIR /build
COPY edu-conect-rural-server/ .

# ── Binario del perfil core: sin la feature `zim` ──
# Sin `--features`: la feature no está en `default` (ver Cargo.toml), así que
# este binario no compila zim-rs ni enlaza libzim.
FROM rust-builder AS binario-core
RUN cargo build --release && strip target/release/edu-conect-rural-server

# ── Binario del perfil full: con la feature `zim`, explícita ──
FROM rust-builder AS binario-full
RUN cargo build --release --features zim && strip target/release/edu-conect-rural-server

# ── Builder: Next.js (obligatorio — produce out/ para el runtime) ──
FROM node:22-slim AS next-builder

WORKDIR /build
COPY edu-conect-rural-dashboard/package.json ./
COPY edu-conect-rural-dashboard/package-lock.json ./
RUN npm ci --ignore-scripts

COPY edu-conect-rural-dashboard/ ./
RUN npm run build
RUN test -f out/index.html

# ── Builder: biblioteca incluida (16 PDFs verificados por manifiesto) ──
# Manifiesto versionado con URL + SHA-256 + tamaño + licencia. Contenido
# educativo NO ZIM, compartido por los dos perfiles: reproducible y verificado
# de forma estricta. Sólo lectura en runtime.
FROM debian:bookworm-slim AS content-builder-biblioteca

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl jq \
    && rm -rf /var/lib/apt/lists/*

COPY edu-conect-rural-server/manifiesto-biblioteca.json /manifiesto-biblioteca.json
COPY edu-conect-rural-server/download-biblioteca-manifiesto.sh /download-biblioteca-manifiesto.sh
RUN chmod +x /download-biblioteca-manifiesto.sh \
    && /download-biblioteca-manifiesto.sh /manifiesto-biblioteca.json /default-content/biblioteca

# ── Runtime compartido: SO, dependencias comunes, usuario y contenido no-ZIM ──
# Ninguna etapa de contenido ZIM cuelga de acá: no hay descarga de ZIM en el
# grafo que construyen `core` ni `full`.
FROM debian:bookworm-slim AS runtime-base

# Sin libzim8: la cadena nativa del lector es exclusiva del perfil `full` y se
# instala en su etapa final. Una imagen que declara una capacidad que no tiene
# es tan engañosa como un binario que no puede leer su propio contenido.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl ffmpeg espeak-ng yt-dlp libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10001 educonnect \
    && useradd \
      --uid 10001 \
      --gid 10001 \
      --create-home \
      --home-dir /home/educonnect \
      --shell /usr/sbin/nologin \
      educonnect

# Directorios mutables: el volumen named /data se entrega a educonnect.
# Para volúmenes nuevos: docker compose run --rm --user 0:0 --entrypoint chown \
#   educonect -R 10001:10001 /data
RUN mkdir -p \
      /data/videos \
      /data/biblioteca \
      /data/contenido/zim \
    && chown -R 10001:10001 /data /home/educonnect

COPY --from=rust-builder /build/static/ /app/static/
COPY --from=next-builder /build/out/ /app/frontend/
COPY edu-conect-rural-dashboard/modulos/ /app/modulos/
# Biblioteca incluida de fábrica: 16 PDFs verificados (manifiesto + SHA-256).
COPY --from=content-builder-biblioteca /default-content/biblioteca/ /app/default-content/biblioteca/

ENV DATA_DIR=/data \
    DEFAULT_BIBLIOTECA_DIR=/app/default-content/biblioteca \
    FRONTEND_PATH=/app/frontend/ \
    LISTEN_ADDR=0.0.0.0:8080 \
    RUST_LOG=info

WORKDIR /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

EXPOSE 8080

# El usuario y el punto de entrada NO se declaran acá: el perfil `full` todavía
# necesita root para instalar la cadena nativa del lector. Cada etapa final
# declara cómo se ejecuta, y las dos lo hacen con el mismo usuario sin
# privilegios (UID/GID 10001).

# ── Perfil full: feature `zim` + bibliotecas nativas del lector ──
# Contenido: NADA embebido. El ZIM se monta en /data/contenido/zim, que es la
# zona escribible que el servidor ya escanea; /app/default-content/zim queda
# como zona de sólo lectura, vacía a propósito.
FROM runtime-base AS full

RUN apt-get update && apt-get install -y --no-install-recommends \
    libzim8 \
    libxapian30 \
    libicu72 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/default-content/zim

COPY --from=binario-full /build/target/release/edu-conect-rural-server /app/server

ENV DEFAULT_ZIM_DIR=/app/default-content/zim

# Ejecutar como usuario sin privilegios (docker exec también entra como 10001)
USER 10001:10001
ENTRYPOINT ["/app/server"]

# ── Perfil core: sin la feature `zim`, sin cadena nativa, sin contenido ZIM ──
# Nótese que no define DEFAULT_ZIM_DIR: la variable ni se lee en este binario
# (está detrás de `#[cfg(feature = "zim")]`), y declararla sugeriría una
# capacidad que el perfil no tiene.
FROM runtime-base AS core

COPY --from=binario-core /build/target/release/edu-conect-rural-server /app/server

# Ejecutar como usuario sin privilegios (docker exec también entra como 10001)
USER 10001:10001
ENTRYPOINT ["/app/server"]
