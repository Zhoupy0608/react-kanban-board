# 公网固定地址部署（Render 等平台）
# 本地开发请用: npm start → http://localhost:5000

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000
# Hugging Face / 无持久盘时用容器内目录
ENV DATA_DIR=/data
# 生产请通过编排系统覆盖：-e JWT_SECRET=...
ENV JWT_SECRET=change-me-in-production

RUN mkdir -p /data

EXPOSE 5000

CMD ["node", "server.js", "--prod"]
