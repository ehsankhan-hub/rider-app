FROM node:20-alpine
WORKDIR /app
COPY packages/shared ./packages/shared
COPY services/auth/package.json ./services/auth/package.json
WORKDIR /app/services/auth
RUN npm install --omit=dev=false
COPY services/auth ./
EXPOSE 3001
CMD ["sh", "-c", "npx tsx src/config/migrate.ts && npx tsx src/server.ts"]
