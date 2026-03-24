# ── Build stage ───────────────────────────────────────────────────────────────
FROM rust:1.86-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ src/
COPY web/ web/
COPY courses/ courses/

RUN cargo build --release

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    gcc \
    libc6-dev \
    python3 \
    nodejs \
    golang-go \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/rust-course /app/rust-course
COPY --from=builder /app/courses/ /app/courses/

EXPOSE 3000

CMD ["/app/rust-course", "serve", "--courses-dir", "courses", "--port", "3000", "--host", "0.0.0.0"]
