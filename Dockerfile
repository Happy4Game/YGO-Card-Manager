FROM node:25-alpine3.22 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.29.8-alpine
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist ./
