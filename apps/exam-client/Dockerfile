FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/exam-client/package.json apps/exam-client/package.json
RUN pnpm install --frozen-lockfile=false

FROM node:22-alpine AS runner
WORKDIR /repo
RUN corepack enable
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/exam-client/node_modules ./apps/exam-client/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY apps/exam-client ./apps/exam-client

WORKDIR /repo/apps/exam-client
EXPOSE 3100
CMD ["pnpm", "dev"]
