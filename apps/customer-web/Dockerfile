FROM node:20-alpine AS build
WORKDIR /app
COPY apps/customer-web/package.json ./
RUN npm install
COPY apps/customer-web ./
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/customer-web/browser /usr/share/nginx/html
EXPOSE 80
