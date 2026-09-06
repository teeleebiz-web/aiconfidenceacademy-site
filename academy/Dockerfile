FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:academy

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/private-dist ./private-dist
COPY academy/server.mjs ./academy/server.mjs
USER node
EXPOSE 3000
CMD ["node", "academy/server.mjs"]
