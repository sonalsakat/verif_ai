FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# This is a single-package pnpm project: no pnpm-workspace.yaml exists.
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Includes client/, server/, shared/, vite config, and the rest of the real source tree.
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Keep the full installed dependency tree: the current server bundle imports Vite at runtime.
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# ensureSchema checks both the bundled path and the source-tree path.
COPY --from=build --chown=node:node /app/server/schema.sql ./server/schema.sql
COPY --from=build --chown=node:node /app/server/schema.sql ./dist/schema.sql

USER node
# The server defaults to 3000 locally and binds Render's injected PORT when deployed.
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/healthz').then((r) => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["node", "dist/index.js"]
