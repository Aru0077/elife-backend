# 部署指南 - eLife Backend

## CORS 修复部署说明

### 修改内容

已在 `src/main.ts` 中添加 CORS 配置，解决前端跨域访问问题。

### 部署步骤

#### 方法一：通过微信云托管控制台部署（推荐）

1. **登录微信云托管控制台**
   - 访问：https://console.cloud.tencent.com/tcb
   - 进入环境 `mongilian-elife-0g2lm9x44b334961`
   - 选择"云托管"

2. **配置环境变量（重要！）**
   - 进入服务详情 → 配置管理 → 环境变量
   - 添加或确认存在以下环境变量：
     ```
     CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
     ```
   - 这样云端后端就可以接受来自本地前端的请求

3. **上传代码**
   - 方式1：通过控制台上传代码压缩包
   - 方式2：连接 Git 仓库自动部署
   - 方式3：使用 CloudBase CLI 部署（见方法二）

4. **触发构建**
   - 系统会自动使用 Dockerfile 构建镜像
   - 构建完成后自动部署到云托管服务
   - **注意**：`container.config.json` 中已包含 CORS 配置

5. **验证部署**
   - 检查服务状态是否为"运行中"
   - 访问：https://elife-backend-190528-4-1380280064.sh.run.tcloudbase.com/health
   - 测试 CORS（见下方验证步骤）

#### 方法二：使用 CloudBase CLI 部署

1. **安装 CloudBase CLI**
   ```bash
   npm install -g @cloudbase/cli
   ```

2. **登录云开发**
   ```bash
   tcb login
   ```

3. **部署到云托管**
   ```bash
   cd /Users/code/elife-2025/elife-backend
   tcb run deploy --name elife-backend --envId mongilian-elife-0g2lm9x44b334961
   ```

4. **查看部署状态**
   ```bash
   tcb run list --envId mongilian-elife-0g2lm9x44b334961
   ```

#### 方法三：手动构建 Docker 镜像

1. **构建镜像**
   ```bash
   cd /Users/code/elife-2025/elife-backend
   docker build -t elife-backend:latest .
   ```

2. **推送到腾讯云容器镜像仓库**
   ```bash
   # 登录腾讯云容器镜像服务
   docker login ccr.ccs.tencentyun.com

   # 打标签
   docker tag elife-backend:latest ccr.ccs.tencentyun.com/your-namespace/elife-backend:latest

   # 推送镜像
   docker push ccr.ccs.tencentyun.com/your-namespace/elife-backend:latest
   ```

3. **在控制台更新服务**
   - 进入云托管控制台
   - 选择 elife-backend 服务
   - 点击"版本管理" → "新建版本"
   - 选择刚推送的镜像

### 验证 CORS 修复

#### 本地测试已通过

```bash
# 测试预检请求（OPTIONS）
curl -X OPTIONS http://localhost:3000/health \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: GET" \
  -i

# 期望响应头：
# Access-Control-Allow-Origin: http://localhost:5174
# Access-Control-Allow-Credentials: true
# Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
# Access-Control-Allow-Headers: Content-Type,Authorization,X-Mock-Openid,X-WX-OPENID

# 测试实际请求
curl -X GET http://localhost:3000/health \
  -H "Origin: http://localhost:5174" \
  -H "X-Mock-Openid: dev-test-user-001" \
  -i

# 期望响应：
# HTTP/1.1 200 OK
# Access-Control-Allow-Origin: http://localhost:5174
# {"code":200,"data":{"status":"ok","timestamp":"..."},...}
```

#### 部署后测试

1. **从浏览器测试**
   - 打开微信开发者工具
   - 访问 http://localhost:5174
   - 点击"测试 API 调用"按钮
   - 应该不再出现 CORS 错误

2. **查看网络请求**
   - 打开浏览器开发者工具 → Network 标签
   - 检查 `/health` 请求
   - 响应头应包含：
     - `Access-Control-Allow-Origin: http://localhost:5174`
     - `Access-Control-Allow-Credentials: true`

### CORS 配置说明

**CORS 域名配置方式：**

1. **通过环境变量配置（推荐）**

   在云托管控制台的环境变量中添加：
   ```
   CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
   ```

   或者在 `container.config.json` 中配置（已配置）。

2. **默认域名规则：**

   - **开发环境**（NODE_ENV ≠ production）：
     - http://localhost:5173
     - http://localhost:5174
     - http://127.0.0.1:5173
     - http://127.0.0.1:5174
     - http://192.168.x.x:5173 (局域网)
     - http://192.168.x.x:5174 (局域网)

   - **生产环境**（NODE_ENV = production）：
     - https://servicewechat.com
     - https://*.servicewechat.com
     - 加上 `CORS_ALLOWED_ORIGINS` 环境变量中的域名

3. **紧急调试选项：**

   如果需要临时允许所有域名（不推荐，仅用于调试）：
   ```
   ALLOW_ALL_ORIGINS=true
   ```

**允许的 HTTP 方法：**
- GET, POST, PUT, DELETE, PATCH, OPTIONS

**允许的请求头：**
- Content-Type
- Authorization
- X-Mock-Openid（开发环境）
- X-WX-OPENID（生产环境）

### 常见问题

#### Q1: 部署后仍然有 CORS 错误？

**A:** 检查以下几点：

1. **确认环境变量已配置**
   ```bash
   # 测试是否返回 Access-Control-Allow-Origin 头
   curl -X OPTIONS https://your-backend-url/health \
     -H "Origin: http://localhost:5174" \
     -H "Access-Control-Request-Method: GET" \
     -i | grep "access-control-allow-origin"
   ```

   如果没有返回该响应头，说明：
   - 环境变量 `CORS_ALLOWED_ORIGINS` 未配置
   - 或者服务尚未重启加载新配置

2. **在云托管控制台检查环境变量**
   - 进入服务详情 → 配置管理 → 环境变量
   - 确认 `CORS_ALLOWED_ORIGINS` 存在且包含 `http://localhost:5174`
   - 如果修改了环境变量，需要重启服务

3. **清除浏览器缓存**
   - 浏览器可能缓存了 CORS 预检请求结果
   - 尝试硬刷新（Ctrl+Shift+R 或 Cmd+Shift+R）

4. **查看云托管日志**
   - 检查服务启动日志，确认 CORS 配置已加载
   - 查找是否有 CORS 相关的错误信息

#### Q2: 如何添加新的允许域名？

**A:** 有两种方式：

**方式1：通过环境变量（推荐，无需重新构建代码）**

在云托管控制台的环境变量中修改或添加：
```
CORS_ALLOWED_ORIGINS=http://localhost:5174,https://your-new-domain.com
```

多个域名用逗号分隔，修改后重启服务即可生效。

**方式2：修改代码**

编辑 `src/main.ts`，在代码中硬编码域名（需要重新构建和部署）。不推荐此方式。

#### Q3: 如何查看部署日志？

**A:**
- 控制台：云托管 → 服务详情 → 日志
- CLI：`tcb run logs --name elife-backend --envId mongilian-elife-0g2lm9x44b334961`

### 回滚步骤

如果部署后出现问题，可以快速回滚：

1. 进入云托管控制台
2. 选择 elife-backend 服务
3. 点击"版本管理"
4. 选择上一个稳定版本
5. 点击"回滚到此版本"

### 监控和告警

部署后建议：
1. 设置服务可用性监控
2. 配置告警通知（服务异常时发送通知）
3. 定期查看访问日志和错误日志

### 相关文档

- 微信云托管文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
- CloudBase CLI 文档：https://docs.cloudbase.net/cli/intro.html
- NestJS CORS 文档：https://docs.nestjs.com/security/cors

---

**更新时间**: 2025-10-11
**维护状态**: ✅ 已测试通过
