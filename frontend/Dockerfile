FROM node:24-alpine AS build

WORKDIR /workspace

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=80

WORKDIR /app

COPY --from=build /workspace/dist/frontend ./

EXPOSE 80

CMD ["node", "server/server.mjs"]
