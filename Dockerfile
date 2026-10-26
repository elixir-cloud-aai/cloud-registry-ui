# Build stage: dependencies, sources and the build; none of it is kept
FROM oven/bun:1.3.14 AS build
WORKDIR /app

# Install deps
COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile

# Settings built into the app, passed with `docker build --build-arg`; they
# are public (they reach the browser and the image history). The login
# settings, with the client secret, are passed when the container starts.
# Keep the list in line with the `process.env.NEXT_PUBLIC_*` uses in src/.
ARG NEXT_PUBLIC_CLOUD_REGISTRY_URL
ARG NEXT_PUBLIC_SERVICE_URL_SCHEMES
ARG NEXT_PUBLIC_SERVICE_ENVIRONMENTS
ARG NEXT_PUBLIC_APP_TITLE
ARG NEXT_PUBLIC_APP_TITLE_SIZE
ARG NEXT_PUBLIC_APP_TITLE_FONT
ARG NEXT_PUBLIC_APP_LOGO
ARG NEXT_PUBLIC_APP_LOGO_DARK
ARG NEXT_PUBLIC_FOOTER_LOGO
ARG NEXT_PUBLIC_FOOTER_LOGO_DARK
ARG NEXT_PUBLIC_FOOTER_START_YEAR
RUN test -n "$NEXT_PUBLIC_CLOUD_REGISTRY_URL" || { \
    echo "Set NEXT_PUBLIC_CLOUD_REGISTRY_URL with --build-arg" >&2; exit 1; }

# Build the standalone server (`.env*` files are excluded by `.dockerignore`)
COPY . .
RUN NEXT_OUTPUT=standalone bun run build

# Runtime stage: only the standalone server, its static files and `public/`
FROM oven/bun:1.3.14
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Owned by root, so that the server can't change its own code; it writes
# only to `.next/cache`
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p .next/cache && chown bun:bun .next/cache

USER bun
EXPOSE 3000

# The start page redirects to the dashboard; the redirect is enough
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["bun", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3000}/`, { redirect: 'manual' }).then((res) => process.exit(res.status < 400 ? 0 : 1), () => process.exit(1))"]

# Listen on all interfaces; set here, as container platforms such as
# Kubernetes set `HOSTNAME` to the container's host name
CMD ["env", "HOSTNAME=0.0.0.0", "bun", "server.js"]
