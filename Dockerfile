# Base
FROM oven/bun:1.3.14
WORKDIR /app

# Install deps
COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile

# Settings built into the app, passed with `docker build --build-arg`; they
# are public (they reach the browser and the image history). The login
# settings, with the client secret, are passed when the container starts.
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

# Build (`.env*` files are excluded by `.dockerignore`)
COPY . .
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
