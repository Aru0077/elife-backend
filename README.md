# eLife Backend

> 境外话费充值后端服务 - NestJS 11 + 微信云托管

[![NestJS](https://img.shields.io/badge/NestJS-11.0-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.16-brightgreen.svg)](https://www.prisma.io/)

---

## 📖 项目概述

eLife Backend 是一个专为**境外话费充值**业务设计的后端系统，集成微信云托管、Unitel API 等服务。

### 核心功能

- ✅ 微信小程序/公众号用户认证
- ✅ 境外运营商话费/流量充值（Unitel API）
- ✅ 订单管理与微信支付集成
- ✅ 充值失败自动补偿机制
- ✅ 数据统计与分析
- ✅ 中文错误提示

### 技术亮点

- 🚀 **无 Redis** - 简化部署，降低成本
- 🔒 **三层幂等性保护** - 充值请求只发送一次
- ⚡ **<10ms 响应** - 微信支付回调快速处理
- 📊 **自动补偿** - 定时任务处理失败订单
- 🎯 **类型安全** - TypeScript 严格模式

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
npx prisma generate
```

### 配置环境变量

复制 `.env.development` 并填写配置：

```env
# 数据库
DATABASE_URL="mysql://user:pass@host:port/db"

# 微信配置
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
WECHAT_MCH_ID=your_mch_id       # 支付商户号
WECHAT_ENV_ID=your_env_id       # 云托管环境ID

# Unitel API
UNITEL_API_URL=https://api.unitel.mn/api/v1
UNITEL_USERNAME=your_username
UNITEL_PASSWORD=your_password
```

### 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

### 访问

- **应用**: http://localhost:3000
- **API 文档**: http://localhost:3000/api
- **健康检查**: http://localhost:3000/health

---

## 📁 项目结构

```
src/
├── modules/
│   ├── order/         # 订单管理（核心）
│   ├── payment/       # 微信支付
│   ├── unitel/        # Unitel API 集成
│   ├── wechat/        # 微信云调用
│   ├── auth/          # 微信认证
│   ├── user/          # 用户管理
│   ├── statistics/    # 数据统计
│   └── health/        # 健康检查
├── common/            # 公共模块
│   ├── filters/       # 全局异常过滤器
│   ├── interceptors/  # 响应拦截器
│   ├── middleware/    # 日志中间件
│   └── prisma/        # Prisma 服务
└── config/            # 配置管理
```

---

## 💡 核心业务流程

### 充值流程

```
用户下单 → 微信支付 → 支付回调 → 异步充值 → 状态更新
                              ↓
                    定时补偿（每分钟）
```

### 幂等性保护

1. **支付回调层**: `updateMany` 乐观锁
2. **充值处理层**: `rechargeAt` 时间戳
3. **状态检查层**: 充值状态验证

---

## 🗄️ 数据库

### Users 表

- **主键**: openid (微信用户ID)
- **字段**: openid, unionid, appid, created_at, updated_at

### Orders 表

- **主键**: order_number (订单号)
- **产品信息**: operator, recharge_type, name, code, price_tg, price_rmb
- **订单状态**: payment_status (unpaid/paid), recharge_status (pending/success/failed)
- **时间戳**: created_at, paid_at, recharge_at

---

## 🚢 部署

### 微信云托管

1. **绑定商户号** - 控制台配置微信支付
2. **配置环境变量** - 添加必需配置
3. **数据库迁移** - `npx prisma migrate deploy`
4. **部署服务** - 通过 Dockerfile 构建

### container.config.json

```json
{
  "containerPort": 80,
  "minNum": 0,
  "maxNum": 50,
  "cpu": 0.25,
  "mem": 0.5
}
```

---

## 📊 API 响应格式

### 成功

```json
{
  "code": 200,
  "data": {...},
  "message": "success",
  "timestamp": "2025-10-10T12:00:00.000Z"
}
```

### 失败（中文错误）

```json
{
  "code": 400,
  "message": "手机号码不能为空",
  "data": null,
  "timestamp": "2025-10-10T12:00:00.000Z",
  "path": "/orders"
}
```

---

## ❓ 常见问题

### Q: 服务重启会丢失充值任务吗？

**A**: 不会。定时补偿任务每分钟自动处理 `pending` 状态的订单。

### Q: 充值失败如何处理？

**A**: 系统不会自动重试（Unitel 自己会重试），定时任务记录失败订单日志供人工处理。

### Q: 如何测试受保护接口？

**A**: 本地使用 Mock 用户：
```bash
curl -H "X-Mock-Openid: test_user" http://localhost:3000/users/me
```

---

## 🔧 技术栈

- **框架**: NestJS 11.0.1
- **语言**: TypeScript 5.7.3
- **数据库**: Prisma 6.16.3 + MySQL 8.0+
- **定时任务**: @nestjs/schedule 6.0.1
- **API 文档**: Swagger 11.2.0
- **HTTP 客户端**: @nestjs/axios 4.0.1

---

## 📝 更新日志

### 2025-10-10
- ✅ 验证错误消息改为中文
- ✅ 优化日志系统（修复 JSON 格式问题）
- ✅ 增强支付和充值流程日志

### 2025-10-09
- ✅ 实现微信支付功能
- ✅ 修复 Dockerfile Prisma 生成问题
- ✅ 支持流量包充值
- ✅ 添加环境变量验证
- ✅ Unitel Token 重试机制

### 2025-10-07
- ✅ 项目初始化
- ✅ 核心业务功能实现

---

## 📄 License

MIT

---

**创建时间**: 2025-10-07
**最后更新**: 2025-10-10
**维护状态**: ✅ 活跃维护
