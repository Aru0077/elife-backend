# eLife Backend 部署指南

## 目录
- [环境变量配置](#环境变量配置)
- [微信云托管部署](#微信云托管部署)
- [数据库配置](#数据库配置)
- [常见问题](#常见问题)

## 环境变量配置

### 必需配置

以下环境变量**必须**在生产环境配置:

```bash
# 数据库连接
DATABASE_URL="mysql://user:password@host:3306/elife"

# Unitel API 认证
UNITEL_USERNAME=your_username
UNITEL_PASSWORD=your_password

# 微信支付配置
WECHAT_MCH_ID=1900006511          # 微信支付子商户号
WECHAT_ENV_ID=prod-xxxxx          # 云托管环境ID
```

### 可选配置

```bash
# Node 环境
NODE_ENV=production
PORT=3000

# Unitel API配置
UNITEL_API_URL=https://api.unitel.mn/api/v1  # Unitel API地址
UNITEL_TIMEOUT=30000                          # API超时时间(毫秒)
UNITEL_TOKEN_CACHE_TIME=90                    # Token缓存时间(秒)

# 数据库重试配置
DB_MAX_RETRIES=5
DB_RETRY_DELAY=5000

# 日志配置
LOG_LEVEL=info                    # debug | info | warn | error
LOG_MAX_FILES=30                  # 日志文件保留天数

# 腾讯云日志服务CLS(可选)
CLS_ENABLED=true
CLS_SECRET_ID=AKIDxxxxxxxxxx
CLS_SECRET_KEY=xxxxxxxxxx
CLS_TOPIC_ID=xxxxxx-xxxx-xxxx
CLS_ENDPOINT=ap-shanghai.cls.tencentyun.com
CLS_RETRY_TIMES=10

# CORS配置(仅非云托管环境需要)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# 充值重试配置
RECHARGE_RETRY_MAX_ATTEMPTS=3
RECHARGE_RETRY_DELAY_MS=5000

# 定时任务开关
TASK_RETRY_PENDING_ENABLED=true
TASK_CHECK_FAILED_ENABLED=true
TASK_CHECK_TRANSACTION_ENABLED=true

# 微信支付回调配置
WECHAT_PAYMENT_CALLBACK_SERVICE=elife-backend
WECHAT_PAYMENT_CALLBACK_PATH=/payment/callback
WECHAT_PAYMENT_SERVER_IP=127.0.0.1
```

### 云托管环境不需要的配置

❌ **以下配置在微信云托管环境中不需要配置**:

```bash
# ❌ 小程序 APPID (云托管自动通过 HTTP Headers 注入)
WECHAT_APPID=wxxxxxxxxxxx

# ❌ 小程序 Secret (云托管免登录认证)
WECHAT_SECRET=xxxxxxxxxxxxxxxx

# ❌ 公众号 APPID (资源复用场景自动识别)
WECHAT_MP_APPID=wxxxxxxxxxxx

# ❌ 公众号 Secret (云托管免登录认证)
WECHAT_MP_SECRET=xxxxxxxxxxxxxxxx
```

**原因**: 微信云托管通过以下 HTTP Headers 自动注入用户身份信息:
- `X-WX-OPENID`: 用户 openid
- `X-WX-APPID`: 来源 AppID
- `X-WX-UNIONID`: 用户 unionid (如果满足条件)
- `X-WX-FROM-*`: 资源复用场景的身份信息
- `X-WX-SOURCE`: 调用来源

详见: [云托管小程序登录流程优化](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/quickstart/plan/login.html)

## 微信云托管部署

### 1. 前置准备

1. 在微信公众平台创建小程序/公众号
2. 开通微信云托管服务
3. 配置微信支付商户号

### 2. 部署步骤

#### 2.1 构建镜像

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 构建项目
npm run build

# 构建 Docker 镜像
docker build -t elife-backend:latest .
```

#### 2.2 配置云托管

1. 在云托管控制台创建服务
2. 配置环境变量(参考上面的[必需配置](#必需配置))
3. 上传镜像
4. 部署服务

#### 2.3 配置数据库

```bash
# 运行数据库迁移
npx prisma migrate deploy

# 初始化汇率数据
npx prisma db seed
```

### 3. 资源复用场景

如果需要**多个小程序/公众号共享同一个云托管服务**:

1. **无需额外配置** - 云托管自动处理资源复用
2. 用户身份通过 `X-WX-FROM-*` Headers 传递
3. 项目已实现资源复用逻辑:
   - `WechatAuthGuard` 优先读取 `X-WX-FROM-OPENID`
   - 数据库通过 `appid` 区分不同来源用户

**文档参考**:
- `/root/wechat_cloud_docs/云托管小程序登录流程优化-微信开放文档.md`
- `/root/wechat_cloud_docs/其他客户端-访问云托管服务-微信开放文档.md`

## 数据库配置

### 连接格式

```
DATABASE_URL="mysql://用户名:密码@主机:端口/数据库名?schema=public"
```

### 示例

```bash
# 本地开发
DATABASE_URL="mysql://root:password@localhost:3306/elife"

# 云托管内网连接
DATABASE_URL="mysql://admin:password@10.0.0.1:3306/elife"
```

### 数据库表结构

项目使用 Prisma ORM,表结构定义在 `prisma/schema.prisma`:

- `users`: 用户表
- `orders`: 订单表
- `exchange_rates`: 汇率配置表

## 常见问题

### Q1: 充值失败如何处理?

**A**: 项目实现了完善的失败重试机制:

1. **自动补偿**: 每分钟补偿 PENDING 状态订单
2. **结果查询**: 每5分钟查询待确认订单的最终状态
3. **失败告警**: 每5分钟统计失败订单并记录日志

查看定时任务配置: `src/modules/wechat-mp/order/order-task.service.ts`

### Q2: 如何查看充值结果?

**A**: 充值结果通过 `seqId` 字段查询:

```typescript
// 调用 Unitel API 查询结果
const result = await unitelService.checkTransactionResult({
  seq_id: order.seqId
});
```

**注意**:
- 充值接口返回的 `seq` 或 `seq_id` 字段用于后续查询
- 项目已兼容两种字段命名方式

### Q3: 微信支付回调失败怎么办?

**A**: 支付回调实现了幂等性保护:

1. 使用乐观锁防止重复处理
2. 即使异常也返回成功(避免微信持续重试)
3. 通过定时任务补偿处理失败的订单

查看回调逻辑: `src/modules/wechat-mp/payment/payment.controller.ts:57`

### Q4: 如何自定义定时任务?

**A**: 修改环境变量控制定时任务开关:

```bash
# 禁用失败订单检查
TASK_CHECK_FAILED_ENABLED=false

# 禁用待确认订单查询
TASK_CHECK_TRANSACTION_ENABLED=false

# 禁用 PENDING 订单补偿
TASK_RETRY_PENDING_ENABLED=false
```

### Q5: 如何配置日志级别?

**A**: 设置 `LOG_LEVEL` 环境变量:

```bash
# 开发环境: 详细日志
LOG_LEVEL=debug

# 生产环境: 关键日志
LOG_LEVEL=info

# 仅错误日志
LOG_LEVEL=error
```

## 订单充值完整流程

### 1. 创建订单
```
用户 -> POST /orders
  ├─ 验证用户身份 (WechatAuthGuard)
  ├─ 验证商品信息 (调用 Unitel API)
  ├─ 计算汇率
  └─ 创建订单 (状态: unpaid)
```

### 2. 发起支付
```
用户 -> POST /payment/create
  ├─ 调用微信统一下单接口
  └─ 返回小程序支付参数
```

### 3. 支付回调
```
微信服务器 -> POST /payment/callback/:orderNumber
  ├─ 验证支付结果
  ├─ 更新订单状态 (paid)
  ├─ 标记充值状态 (pending)
  └─ 异步触发充值
```

### 4. 执行充值
```
异步充值任务 -> rechargeOrder()
  ├─ 乐观锁防止重复充值
  ├─ 调用运营商 API (Unitel)
  │   ├─ 话费充值: recharge()
  │   ├─ 流量包: activateDataPackage()
  │   └─ 账单支付: payPostpaidBill()
  ├─ 保存 seqId
  └─ 更新充值状态 (success/failed/pending)
```

### 5. 结果确认(可选)
```
定时任务 (每5分钟) -> checkPendingTransactionResults()
  ├─ 查询 PENDING 状态订单
  ├─ 调用 checkTransactionResult(seqId)
  └─ 更新最终状态 (success/failed)
```

### 6. 失败补偿
```
定时任务 (每分钟) -> retryPendingRecharges()
  ├─ 查询卡在 PENDING 且未发送充值请求的订单
  └─ 重新发送充值请求
```

## 技术栈

- **框架**: NestJS 11
- **数据库**: MySQL + Prisma ORM
- **运行时**: Node.js 22+
- **部署**: Docker + 微信云托管

## 联系方式

如有问题,请查看项目 README 或提交 Issue。
