# ===== build =====
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
COPY packages/game-core/package.json packages/game-core/package.json
RUN npm install

COPY . .
RUN npm run build -w packages/game-core
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build -w server
RUN npm run build -w web

# ===== runtime =====
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/packages/game-core/dist ./packages/game-core/dist
COPY --from=build /app/packages/game-core/package.json ./packages/game-core/package.json
COPY --from=build /app/web/dist ./web/dist

EXPOSE 4000

# 起動時にマイグレーションを適用してからサーバーを起動する
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
