FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY release ./release
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/release ./release
ENTRYPOINT ["node", "dist/main.js"]
