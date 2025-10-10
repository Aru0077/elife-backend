# 腾讯云CLS日志服务配置指南

## 功能说明

项目已集成腾讯云CLS（Cloud Log Service）日志服务，实现日志持久化存储。

### 特性

- ✅ 自动采集所有HTTP请求/响应日志
- ✅ 包含TraceID便于日志追踪
- ✅ 批量异步上传（每10条或每5秒）
- ✅ 不阻塞主请求，不影响性能
- ✅ 双写模式：同时输出到stdout和CLS
- ✅ 失败自动重试

## 开通CLS服务

### 1. 创建日志集和日志主题

1. 登录腾讯云控制台：https://console.cloud.tencent.com/cls
2. 选择对应地域（如：广州）
3. 创建日志集（LogSet）
4. 在日志集下创建日志主题（Topic）
5. 记录日志主题ID（格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）

### 2. 配置索引（重要）

在日志主题中配置索引，才能进行检索：

1. 进入日志主题详情
2. 点击"索引配置"
3. 开启"键值索引"
4. 添加以下字段（建议）：
   - `traceId` - 文本类型
   - `method` - 文本类型
   - `url` - 文本类型
   - `statusCode` - 长整型
   - `responseTime` - 文本类型
   - `type` - 文本类型
   - `stage` - 文本类型

### 3. 获取访问凭证

1. 访问：https://console.cloud.tencent.com/cam/capi
2. 创建或查看已有的密钥（SecretId/SecretKey）
3. **重要：妥善保管密钥，不要泄露**

## 配置环境变量

### 开发环境

编辑 `.env.development`：

```bash
# 腾讯云CLS日志服务配置
CLS_ENABLED=true
CLS_SECRET_ID=你的SecretId
CLS_SECRET_KEY=你的SecretKey
CLS_ENDPOINT=ap-guangzhou.cls.tencentcs.com
CLS_TOPIC_ID=你的TopicId
CLS_RETRY_TIMES=10
```

### 生产环境（微信云托管）

在微信云托管控制台配置环境变量：

1. 进入服务设置 → 环境变量
2. 添加以下变量：
   - `CLS_ENABLED=true`
   - `CLS_SECRET_ID=你的SecretId`
   - `CLS_SECRET_KEY=你的SecretKey`
   - `CLS_REGION=ap-guangzhou`（根据实际选择）
   - `CLS_TOPIC_ID=你的TopicId`

## 日志查询

### 在CLS控制台查询

1. 进入日志主题 → 检索分析
2. 选择时间范围
3. 使用检索语法：

**查询示例：**

```
# 查询特定TraceID的所有日志
traceId:abc123def4

# 查询慢请求（>500ms）
slow:true

# 查询特定接口
url:*/products/services*

# 查询错误响应
statusCode:>=400

# 组合查询
method:POST AND statusCode:>=400
```

## 工作原理

```
HTTP请求
  ↓
LoggerMiddleware (记录请求日志)
  ↓
同时输出到：
  ├─ stdout（微信云托管日志）
  └─ CLS队列（异步批量上传）
       ↓
     每10条或5秒一次
       ↓
   腾讯云CLS（持久化存储）
```

## 性能说明

- 日志写入队列：**极快**（内存操作）
- 批量上传：**异步**（不阻塞请求）
- 队列满或定时触发上传
- 失败自动重试（放回队列）

## 成本估算

腾讯云CLS按量计费：

- **写流量**：0.18元/GB
- **索引流量**：0.35元/GB
- **日志存储**：0.014元/GB/天
- **免费额度**：每月10GB写流量

**预估（中小型项目）：**
- 日志量：10万条/天
- 每条约：500字节
- 总量：约50MB/天 = 1.5GB/月
- 成本：约1-3元/月

## 注意事项

1. **密钥安全**：不要将密钥提交到代码仓库
2. **开关控制**：通过`CLS_ENABLED`开关控制是否启用
3. **地域选择**：建议选择与服务器同地域，降低延迟
4. **日志保留**：在CLS控制台可设置日志保留时间（如30天、90天）
5. **告警配置**：可在CLS配置告警规则（如错误率>10%）

## 故障排查

### 日志未上传到CLS

1. 检查环境变量是否正确配置
2. 检查`CLS_ENABLED=true`
3. 查看应用日志是否有CLS错误
4. 确认网络连接正常
5. 验证SecretId/SecretKey是否有效

### 日志无法检索

1. 确认索引已配置并开启
2. 等待1-2分钟索引生效
3. 检查时间范围是否正确
4. 确认字段名拼写正确

## 技术实现

- **SDK**: `tencentcloud-cls-sdk-js@1.0.6`（专用日志上传SDK）
- **位置**: `src/common/cls/`
- **集成点**: `src/common/middleware/logger.middleware.ts`
- **批量大小**: 10条
- **上传间隔**: 5秒
- **上传格式**: Protobuf（LogGroup结构）
