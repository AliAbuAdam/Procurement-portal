# Next.js (standalone) — многоступенчатая сборка.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* «запекаются» в бандл при сборке. По умолчанию — относительные
# пути (same-origin за обратным прокси), поэтому образ доменно-независим и годится
# для любого прода. Для локальной сборки под dev можно передать абсолютные URL:
#   docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 ...
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_KRATOS_PUBLIC_URL="/.ory/kratos/public"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_KRATOS_PUBLIC_URL=$NEXT_PUBLIC_KRATOS_PUBLIC_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
