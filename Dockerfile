# 公网部署镜像。本地开发请用: docker compose up -d && npm start

FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000
ENV DB_DRIVER=mysql

# 生产请通过编排覆盖：JWT_SECRET / MYSQL_* / REDIS_URL
ENV JWT_SECRET=change-me-in-production

EXPOSE 5000

CMD ["node", "server.js", "--prod"]
