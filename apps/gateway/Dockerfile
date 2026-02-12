# Stage 1: install dependencies (cached layer)
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Copy all workspace package.json files (pnpm --frozen-lockfile needs the full workspace structure)
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/cli/package.json ./apps/cli/
COPY apps/desktop/package.json ./apps/desktop/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/mobile/package.json ./apps/mobile/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/hooks/package.json ./packages/hooks/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/store/package.json ./packages/store/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/

RUN pnpm install --frozen-lockfile --filter @multica/gateway...

# Stage 2: runtime
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Copy pnpm structure + node_modules (includes hoisted deps and workspace symlinks)
COPY --from=deps /app ./

# Copy workspace packages needed at runtime (raw .ts source, resolved by tsx)
COPY packages/sdk/ ./packages/sdk/
COPY packages/store/ ./packages/store/

# Copy gateway source + static assets
COPY apps/gateway/ ./apps/gateway/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/apps/gateway
CMD ["node", "--import", "tsx", "main.ts"]
