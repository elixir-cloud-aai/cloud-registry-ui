# Build stage: dependencies, sources and the build; none of it is kept
FROM oven/bun:1.4.4 AS build
WORKDIR /app

# Install deps
COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile

# No settings: all are passed when the container starts (see
# `src/lib/public-settings.ts`), so one image serves any deployment

# Build the standalone server (`.dockerignore` lets in only the sources and
# build files, no `.env*` files, keys or credentials)
COPY . .
RUN NEXT_OUTPUT=standalone bun run build

# Runtime stage: only the standalone server, its static files and `public/`
FROM oven/bun:1.4.4
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Security fixes that the base image doesn't have yet, which the scans
# would otherwise report
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Owned by root, so that the server can't change its own code; it writes
# only to `.next/cache` (pages regenerated at runtime, e.g. with
# `revalidate`, would also need `.next/server` to be writable)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/LICENSE /app/NOTICE ./
RUN mkdir -p .next/cache && chown bun:bun .next/cache

USER bun
EXPOSE 3000

# The start page redirects to the dashboard; the redirect is enough
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["bun", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3000}/`, { redirect: 'manual' }).then((res) => process.exit(res.status < 400 ? 0 : 1), () => process.exit(1))"]

# Listen on all IPv4 interfaces, or on `LISTEN_HOSTNAME` (e.g. `::` for
# IPv6); set in CMD, not with ENV, as container runtimes such as
# Kubernetes' set `HOSTNAME` to the container's host name
CMD ["sh", "-c", "HOSTNAME=\"${LISTEN_HOSTNAME:-0.0.0.0}\" exec bun server.js"]
