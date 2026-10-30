FROM node:20-alpine
WORKDIR /app
COPY packages/shared ./packages/shared
COPY services/ride-api/package.json ./services/ride-api/package.json
WORKDIR /app/services/ride-api
RUN npm install --omit=dev=false
COPY services/ride-api ./
EXPOSE 3002
CMD ["sh", "-c", "npx tsx src/config/migrate.ts && npx tsx src/config/seed.ts && npx tsx src/server.ts"]
