FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --no-frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY releases ./releases
EXPOSE 3000
CMD ["node", "dist/main.js"]
