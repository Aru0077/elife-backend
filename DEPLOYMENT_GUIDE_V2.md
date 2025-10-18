# eLife Backend 核心改进部署指南 v2.0

> 本指南适用于2025-01-18核心改进版本的部署

## 📋 改进内容概览

### ✅ 已完成的改进 (v2.0)

1. **充值原子性加固** - 使用乐观锁防止并发重复充值
2. **订单金额验证** - 支付回调时验证金额一致性
3. **attach字段验证** - 验证回调数据完整性
4. **环境配置补充** - 添加完整的配置项和默认值
5. **数据库Schema优化** - 添加版本号、异常标记和优化索引
6. **运营商API状态处理** - 处理不明确的返回状态
7. **数据库重试机制** - 连接和操作失败自动重试

---

## 🚀 部署步骤

### 步骤 1: 环境变量配置

参考 `.env.example` 配置环境变量:

**必需配置:**
```bash
# 数据库
DATABASE_URL="mysql://user:password@host:3306/elife"

# 微信配置
WECHAT_APPID=wxxxxxxxxxxx
WECHAT_MCH_ID=1900006511
WECHAT_ENV_ID=prod-xxxxx

# Unitel API (必填!)
UNITEL_API_URL=https://api.unitel.mn/api/v1
UNITEL_USERNAME=your_username
UNITEL_PASSWORD=your_password
```

**推荐配置:**
```bash
# 日志级别
LOG_LEVEL=info

# 数据库重试
DB_MAX_RETRIES=5
DB_RETRY_DELAY=5000
```

### 步骤 2: 数据库迁移 ⚠️ 重要

**必须执行**以添加新字段和索引:

```bash
# 1. 生成 Prisma Client
npx prisma generate

# 2. 创建迁移文件
npx prisma migrate dev --name add_version_and_anomaly_fields

# 3. 检查生成的SQL(可选)
cat prisma/migrations/*/migration.sql

# 4. 应用到生产环境
npx prisma migrate deploy
```

**新增字段:**
- `version` INT - 乐观锁版本号
- `anomalyReason` VARCHAR(100) - 异常原因
- `anomalyDetails` TEXT - 异常详情

**新增索引:**
- `idx_recharge_status_at_seqid` - 优化定时任务查询
- `idx_payment_recharge_at` - 优化补偿任务查询
- `idx_anomaly_reason` - 异常订单查询

### 步骤 3: 安装依赖并编译

```bash
# 安装依赖
npm install

# 编译项目
npm run build
```

### 步骤 4: 启动服务

**开发环境:**
```bash
npm run start:dev
```

**生产环境:**
```bash
# 使用PM2管理进程
pm2 start dist/main.js --name elife-backend

# 或直接启动
npm run start:prod
```

---

## 🧪 部署后验证

### 1. 检查服务启动

```bash
# 查看PM2进程
pm2 logs elife-backend --lines 50

# 或查看日志文件
tail -f logs/combined.log

# 预期输出:
# [PrismaService] 数据库连接成功
# [NestApplication] Nest application successfully started
```

### 2. 验证数据库Schema

```bash
# 连接数据库
mysql -u user -p elife

# 检查新字段
DESC orders;

# 预期输出应包含:
# version | int | NO | | 0
# anomaly_reason | varchar(100) | YES
# anomaly_details | text | YES

# 检查新索引
SHOW INDEX FROM orders;

# 应包含新的复合索引
```

### 3. 功能测试

#### 测试1: 创建订单
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "phoneNumber": "88888888",
    "productOperator": "UNITEL",
    "rechargeType": "VOICE",
    "productCode": "5000"
  }'

# 预期: 返回订单信息,包含orderNumber
```

#### 测试2: 支付金额验证
```bash
# 模拟金额不匹配的回调
curl -X POST http://localhost:3000/payment/callback/ORD1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "returnCode": "SUCCESS",
    "resultCode": "SUCCESS",
    "totalFee": 999999,
    "transactionId": "WX123456789"
  }'

# 查看日志
tail -f logs/combined.log | grep "支付金额不匹配"

# 预期: 日志记录错误但返回 {errcode:0}
```

#### 测试3: attach字段验证
```bash
# 模拟attach中订单号不一致
curl -X POST http://localhost:3000/payment/callback/ORD1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "returnCode": "SUCCESS",
    "resultCode": "SUCCESS",
    "totalFee": 1000,
    "attach": "{\"orderNumber\":\"ORD999999\"}"
  }'

# 查看日志
grep "attach中的订单号与URL参数不一致" logs/combined.log

# 预期: 记录错误日志
```

#### 测试4: 并发充值防重
```bash
# 使用Apache Bench进行并发测试
ab -n 100 -c 10 -p callback.json \
  -T application/json \
  http://localhost:3000/payment/callback/ORD1234567890

# 或使用自定义脚本
for i in {1..10}; do
  curl -X POST http://localhost:3000/payment/callback/ORD1234567890 \
    -H "Content-Type: application/json" \
    -d '{"returnCode":"SUCCESS","resultCode":"SUCCESS"}' &
done
wait

# 查看日志
grep "订单正在被其他进程处理" logs/combined.log

# 预期: 只有1次成功,其余被拦截
```

---

## 📊 监控SQL查询

### 1. 充值成功率
```sql
SELECT
  rechargeStatus,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 /
    (SELECT COUNT(*) FROM orders WHERE paymentStatus = 'paid'), 2
  ) as percentage
FROM orders
WHERE paymentStatus = 'paid'
GROUP BY rechargeStatus;

-- 预期: success > 95%
```

### 2. 异常订单统计
```sql
SELECT
  anomalyReason,
  COUNT(*) as count,
  DATE(createdAt) as date
FROM orders
WHERE anomalyReason IS NOT NULL
GROUP BY anomalyReason, DATE(createdAt)
ORDER BY date DESC, count DESC;

-- 监控: 每天异常订单应 < 1%
```

### 3. 充值延迟分析
```sql
SELECT
  ROUND(AVG(TIMESTAMPDIFF(SECOND, paidAt, rechargeAt))) as avg_delay_sec,
  MAX(TIMESTAMPDIFF(SECOND, paidAt, rechargeAt)) as max_delay_sec,
  MIN(TIMESTAMPDIFF(SECOND, paidAt, rechargeAt)) as min_delay_sec
FROM orders
WHERE rechargeStatus = 'success'
  AND rechargeAt IS NOT NULL
  AND paidAt > DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- 预期: avg < 5秒, max < 60秒
```

### 4. 待补偿订单监控
```sql
SELECT
  COUNT(*) as pending_count,
  MIN(paidAt) as oldest_paid_at,
  TIMESTAMPDIFF(MINUTE, MIN(paidAt), NOW()) as delay_minutes
FROM orders
WHERE paymentStatus = 'paid'
  AND rechargeStatus = 'pending'
  AND rechargeAt IS NULL
  AND paidAt < DATE_SUB(NOW(), INTERVAL 5 MINUTE);

-- 告警阈值: pending_count > 10 或 delay_minutes > 30
```

---

## 🔍 故障排查手册

### 问题1: 数据库迁移失败

**症状:**
```bash
Error: P3006 Migration failed to apply cleanly to the shadow database
```

**解决方案:**
```bash
# 方案1: 重置shadow数据库
npx prisma migrate reset

# 方案2: 手动执行SQL
mysql -u user -p elife < prisma/migrations/xxx/migration.sql

# 方案3: 强制标记为已应用
npx prisma migrate resolve --applied <migration_name>
```

### 问题2: 仍然出现重复充值

**排查步骤:**
```bash
# 1. 检查代码是否使用了updateMany
grep -n "updateMany" src/modules/wechat-mp/order/order.service.ts

# 2. 查看具体订单的充值记录
mysql> SELECT
  orderNumber,
  rechargeAt,
  rechargeStatus,
  version
FROM orders
WHERE orderNumber = 'ORD123456';

# 3. 检查日志
grep "订单正在被其他进程处理" logs/combined.log
grep "already_processing" logs/combined.log

# 4. 验证数据库索引
mysql> EXPLAIN SELECT * FROM orders
WHERE orderNumber = 'ORD123456' AND rechargeAt IS NULL;
# 应该使用PRIMARY KEY
```

### 问题3: 支付回调金额验证失败

**排查步骤:**
```bash
# 1. 查看订单金额
mysql> SELECT
  orderNumber,
  productPriceTg,
  productPriceRmb,
  ROUND(productPriceRmb * 100) as expected_total_fee
FROM orders
WHERE orderNumber = 'ORD123456';

# 2. 查看回调日志
grep "支付金额不匹配" logs/combined.log

# 3. 检查汇率配置
mysql> SELECT * FROM exchange_rates
WHERE currency = 'MNT_TO_CNY' AND isActive = 1;

# 4. 对比微信回调数据
# 检查 totalFee 字段是否正确(单位:分)
```

### 问题4: 数据库连接频繁断开

**症状:**
```bash
[PrismaService] 数据库连接失败 (尝试 3/5)
[PrismaService] 数据库操作失败，重试中 (2/3)
```

**解决方案:**
```bash
# 1. 调整重试参数
# .env
DB_MAX_RETRIES=10
DB_RETRY_DELAY=3000

# 2. 检查MySQL配置
mysql> SHOW VARIABLES LIKE 'max_connections';
mysql> SHOW VARIABLES LIKE 'wait_timeout';

# 3. 查看当前连接数
mysql> SHOW STATUS LIKE 'Threads_connected';
mysql> SHOW PROCESSLIST;

# 4. Prisma连接池配置(可选)
# prisma/schema.prisma
datasource db {
  url = env("DATABASE_URL")
  # 添加连接池参数
  # pool_size = 10
  # connection_limit = 10
}
```

---

## ⚡ 性能优化

### 1. 索引使用分析

```sql
-- 查看慢查询
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- 分析索引使用
SELECT
  table_name,
  index_name,
  cardinality,
  index_type
FROM information_schema.statistics
WHERE table_schema = 'elife' AND table_name = 'orders';

-- 检查未使用的索引
SELECT * FROM sys.schema_unused_indexes
WHERE object_schema = 'elife';
```

### 2. 查询优化示例

```sql
-- 优化前(慢)
SELECT * FROM orders
WHERE paymentStatus = 'paid'
  AND rechargeStatus = 'pending'
  AND rechargeAt IS NULL;

-- 使用EXPLAIN分析
EXPLAIN SELECT * FROM orders
WHERE paymentStatus = 'paid'
  AND rechargeStatus = 'pending'
  AND rechargeAt IS NULL;

-- 应该看到 key: idx_payment_recharge_at
```

### 3. 定时任务优化

如果订单量很大(>100万),调整定时任务:

```typescript
// src/modules/wechat-mp/order/order-task.service.ts

// 方案1: 减少每次处理数量
take: 5,  // 从10改为5

// 方案2: 增加执行间隔
@Cron('*/2 * * * *')  // 每2分钟

// 方案3: 添加分页处理
let offset = 0;
const limit = 10;
while (true) {
  const orders = await this.prisma.order.findMany({
    skip: offset,
    take: limit,
    // ...
  });
  if (orders.length === 0) break;
  offset += limit;
}
```

---

## 🔄 回滚方案

### 快速回滚步骤

```bash
# 1. 停止服务
pm2 stop elife-backend

# 2. 代码回滚
git log --oneline -10  # 查看最近10次提交
git reset --hard <commit_hash>  # 回滚到指定提交

# 3. 数据库回滚(谨慎!)
npx prisma migrate resolve --rolled-back <migration_name>

# 或手动删除新字段
mysql -u user -p elife << EOF
ALTER TABLE orders DROP COLUMN version;
ALTER TABLE orders DROP COLUMN anomaly_reason;
ALTER TABLE orders DROP COLUMN anomaly_details;
EOF

# 4. 重新构建
npm run build

# 5. 启动服务
pm2 start elife-backend
pm2 logs elife-backend
```

### 数据备份

部署前必须备份:

```bash
# 备份数据库
mysqldump -u user -p elife > elife_backup_$(date +%Y%m%d_%H%M%S).sql

# 备份代码
git tag -a v2.0-pre-deployment -m "Backup before v2.0 deployment"
git push origin v2.0-pre-deployment

# 备份环境变量
cp .env .env.backup.$(date +%Y%m%d)
```

---

## ✅ 上线检查清单

### 部署前检查

- [ ] 代码已提交到Git仓库
- [ ] 数据库已备份
- [ ] 环境变量已配置(.env文件)
- [ ] .env.example已更新
- [ ] 依赖已安装(npm install)
- [ ] 代码已编译(npm run build)
- [ ] 单元测试已通过(如有)

### 部署时检查

- [ ] 数据库迁移已执行(prisma migrate deploy)
- [ ] 新字段已添加(version, anomalyReason, anomalyDetails)
- [ ] 新索引已创建
- [ ] 服务已启动
- [ ] 日志输出正常
- [ ] 数据库连接成功

### 部署后验证

- [ ] 健康检查接口正常(/health)
- [ ] 创建订单功能正常
- [ ] 支付创建功能正常
- [ ] 支付回调功能正常
- [ ] 充值功能正常
- [ ] 定时任务运行正常
- [ ] 日志中无错误
- [ ] 监控指标正常
- [ ] 金额验证日志正常
- [ ] attach验证日志正常

---

## 📞 紧急响应流程

### 严重问题处理

如果发现严重Bug(如重复充值):

1. **立即停止服务**
   ```bash
   pm2 stop elife-backend
   ```

2. **评估影响范围**
   ```sql
   -- 查询可能受影响的订单
   SELECT * FROM orders
   WHERE paymentStatus = 'paid'
     AND createdAt > '部署时间'
     AND rechargeStatus = 'success';
   ```

3. **执行回滚**
   按照上面的回滚方案操作

4. **通知相关方**
   - 技术团队
   - 运营团队
   - 用户(如需要)

5. **记录事故**
   创建事故报告,记录:
   - 问题发现时间
   - 影响范围
   - 处理步骤
   - 根本原因
   - 预防措施

---

## 📚 相关文档

- [Prisma迁移文档](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [NestJS文档](https://docs.nestjs.com/)
- [微信支付API](https://pay.weixin.qq.com/wiki/doc/api/index.html)
- [MySQL索引优化](https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html)

---

**文档版本:** v2.0
**最后更新:** 2025-01-18
**维护者:** 开发团队
