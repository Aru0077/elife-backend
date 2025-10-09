# eLife Backend

> 境外话费充值后端服务 - NestJS 11 + 微信云托管

[![NestJS](https://img.shields.io/badge/NestJS-11.0-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16-brightgreen.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 项目概述

eLife Backend 是一个专为**境外话费充值**业务设计的后端系统，集成微信云托管、Unitel API 等服务。

### 核心功能

- ✅ 微信小程序/公众号用户认证（云托管自动注入）
- ✅ 境外运营商话费充值（Unitel API）
- ✅ 订单管理与微信支付集成
- ✅ 充值失败自动补偿机制
- ✅ 数据统计与分析

### 技术亮点

- 🚀 **无 Redis** - 简化部署，降低成本
- 🔒 **三层幂等性保护** - 充值请求只发送一次
- ⚡ **<10ms 响应** - 微信支付回调快速处理
- 📊 **自动补偿** - 定时任务处理失败订单
- 🎯 **类型安全** - TypeScript 严格模式

---

## 快速开始

### 安装

```bash
npm install
npx prisma generate
```

### 配置

复制 `.env.development` 并填写配置：

```env
DATABASE_URL="mysql://user:pass@host:port/db"
WECHAT_APPID=your_appid
UNITEL_USERNAME=your_username
UNITEL_PASSWORD=your_password
```

### 启动

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run start:prod
```

### 访问

- **应用**: http://localhost:3000
- **API 文档**: http://localhost:3000/api
- **健康检查**: http://localhost:3000/health

---

## 项目结构

```
src/
├── modules/
│   ├── order/         # 订单管理 ⭐
│   ├── unitel/        # Unitel API 集成
│   ├── wechat/        # 微信云调用
│   ├── auth/          # 微信认证
│   ├── user/          # 用户管理
│   └── statistics/    # 数据统计
├── common/            # 公共模块
└── config/            # 配置管理
```

---

## 核心业务流程

### 充值流程

```
创建订单 → 微信支付 → 支付回调 → 异步充值 → 状态更新
                                 ↓
                            定时补偿（每分钟）
                                 ↓
                         失败订单监控（每5分钟）
```

### 幂等性保护

1. **支付回调层**: `updateMany` 乐观锁
2. **充值处理层**: `rechargeAt` 时间戳
3. **状态检查层**: 充值状态验证

---

## 数据库

### Users 表

- **主键**: openid (微信用户ID)
- **字段**: openid, unionid, appid, created_at, updated_at

### Orders 表

- **主键**: order_number (订单号)
- **关键字段**:
  - 产品信息: operator, name, code, price_tg, price_rmb
  - 订单状态: payment_status, recharge_status
  - 时间戳: created_at, paid_at, recharge_at

---

## 部署

### 微信云托管

```json
// container.config.json
{
  "containerPort": 80,
  "cpu": 0.25,
  "mem": 0.5
}
```

### 环境变量

在云托管控制台配置：

```
NODE_ENV=production
DATABASE_URL=mysql://...
WECHAT_APPID=...
UNITEL_USERNAME=...
```

### 数据库迁移

```bash
npx prisma migrate deploy
```

---

## 开发规范

### 代码质量

- ✅ ESLint: 零错误
- ✅ TypeScript: 严格模式
- ✅ 51 个 TS 文件，~2,778 行代码

### Git 提交

```
feat: 新功能
fix: Bug修复
docs: 文档更新
refactor: 重构
```

---

## API 响应格式

### 成功

```json
{
  "code": 200,
  "data": {...},
  "message": "success",
  "timestamp": "2025-10-09T12:00:00.000Z"
}
```

### 失败

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null,
  "path": "/api/xxx"
}
```

---

## 常见问题

### Q: 服务重启会丢失充值任务吗？

**A**: 不会。定时补偿任务每分钟自动处理 `pending` 状态的订单。

### Q: 充值失败如何处理？

**A**: 系统不会自动重试（Unitel 自己会重试），定时任务记录失败订单日志供人工处理。

### Q: 如何测试受保护接口？

**A**: 本地使用 Mock 用户：`curl -H "X-Mock-Openid: test_user" http://localhost:3000/users/me`

---

## 文档

详细文档请查看：**[GUIDE.md](./GUIDE.md)**

包含内容：
- 完整技术栈
- 核心模块详解
- 充值业务流程
- 数据库设计
- 部署指南

---

## 技术栈

- **框架**: NestJS 11.0.1
- **语言**: TypeScript 5.7.3
- **数据库**: Prisma 6.16.3 + MySQL 8.0+
- **定时任务**: @nestjs/schedule 6.0.1
- **API 文档**: Swagger 11.2.0

---

## License

MIT

---

**创建时间**: 2025-10-07
**最后更新**: 2025-10-09
**维护状态**: ✅ 活跃维护
