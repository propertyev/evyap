# EVyap Accounts — production image (PostgreSQL via DATABASE_URL)
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# The Prisma provider is derived from DATABASE_URL at generate time (scripts/set-provider.mjs).
ARG DATABASE_URL="postgresql://evyap:evyap@db:5432/evyap?schema=public"
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build

FROM base AS run
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "scripts/docker-entrypoint.sh"]
