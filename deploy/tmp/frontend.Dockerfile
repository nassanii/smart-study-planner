FROM node:22-alpine AS build

WORKDIR /app

ARG EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL

COPY src/Frontend/app/package*.json ./
RUN npm ci

COPY src/Frontend/app ./
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine

COPY deploy/tmp/nginx-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
