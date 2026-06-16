FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=/api/v1
ARG VITE_DEPLOY_PANEL_MODE=custom
ARG VITE_CHECKER_PUBLIC_URL=https://checker.webflare.ru
ARG VITE_DEPLOY_DOCS_URL=https://checker.webflare.ru/docs/

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEPLOY_PANEL_MODE=$VITE_DEPLOY_PANEL_MODE
ENV VITE_CHECKER_PUBLIC_URL=$VITE_CHECKER_PUBLIC_URL
ENV VITE_DEPLOY_DOCS_URL=$VITE_DEPLOY_DOCS_URL

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
