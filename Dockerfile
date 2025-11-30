FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY api ./api
COPY db.ts ./db.ts
COPY server.ts ./server.ts
COPY supabase ./supabase
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/supabase ./supabase
EXPOSE 3000
CMD ["node", "dist/server.js"]

