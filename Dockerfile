# 多阶段构建 - 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（包括 devDependencies 用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
RUN npm run build

# 生产阶段
FROM node:22-alpine

WORKDIR /app

# 安装 ca-certificates (本地开发需要 HTTPS 调用微信 API)
RUN apk add ca-certificates

# 复制 package 文件
COPY package*.json ./

# 仅安装生产依赖
RUN npm ci --omit=dev && npm cache clean --force

# 复制 Prisma schema
COPY --from=builder /app/prisma ./prisma

# 生成 Prisma Client（生产环境）
RUN npx prisma generate

# 从构建阶段复制编译后的代码
COPY --from=builder /app/dist ./dist

# 创建日志目录
RUN mkdir -p logs

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口
EXPOSE 80

# 启动应用
CMD ["node", "dist/main"]
