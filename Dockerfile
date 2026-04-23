# Base
FROM oven/bun:1.2.21
WORKDIR /app

# Install deps
COPY package*.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]