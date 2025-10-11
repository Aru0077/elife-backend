# CORS 问题修复总结

## 问题诊断

您遇到的错误：
```
Access to fetch at 'https://elife-backend-190528-4-1380280064.sh.run.tcloudbase.com/health'
from origin 'http://localhost:5174' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**根本原因**：云端后端在生产环境（NODE_ENV=production）运行，之前的 CORS 配置只允许微信域名，不允许本地开发域名（localhost:5174）。

## 已完成的修复

### 1. 代码修改

✅ **修改 `src/main.ts`（第 23-73 行）**
- 重构 CORS 配置逻辑
- 添加环境变量支持：`CORS_ALLOWED_ORIGINS`
- 支持动态配置允许的域名
- 保持生产环境和开发环境的基础安全策略

### 2. 配置文件更新

✅ **`.env.production`**
- 添加 `CORS_ALLOWED_ORIGINS` 配置说明
- 默认包含本地开发域名

✅ **`container.config.json`**
- 在 `envParams` 中添加 `CORS_ALLOWED_ORIGINS` 环境变量
- 包含 localhost:5173 和 localhost:5174

### 3. 项目构建

✅ 已重新构建项目，dist 目录包含最新代码

## 下一步：部署到云端

### 方式一：通过云托管控制台（推荐）

1. **登录腾讯云控制台**
   ```
   https://console.cloud.tencent.com/tcb
   环境ID: mongilian-elife-0g2lm9x44b334961
   ```

2. **进入服务配置**
   - 找到您的服务：`elife-backend`
   - 点击"配置管理" → "环境变量"

3. **添加/确认环境变量**
   ```
   变量名: CORS_ALLOWED_ORIGINS
   变量值: http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
   ```

   **重要**：如果使用 `container.config.json` 部署，这个环境变量会自动设置。

4. **部署新版本**
   - 方式1：上传代码压缩包（打包 elife-backend 整个目录）
   - 方式2：通过 Git 仓库自动部署
   - 方式3：使用 CLI（见下方）

5. **等待部署完成**
   - 查看构建日志
   - 等待服务重启
   - 状态变为"运行中"

### 方式二：使用 CloudBase CLI

```bash
# 1. 安装 CLI（如果未安装）
npm install -g @cloudbase/cli

# 2. 登录
tcb login

# 3. 进入项目目录
cd /Users/code/elife-2025/elife-backend

# 4. 部署
tcb run deploy --name elife-backend --envId mongilian-elife-0g2lm9x44b334961

# 5. 查看状态
tcb run list --envId mongilian-elife-0g2lm9x44b334961
```

## 验证部署

### 1. 测试 CORS 预检请求

```bash
curl -X OPTIONS https://elife-backend-190528-4-1380280064.sh.run.tcloudbase.com/health \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: GET" \
  -i | grep -i "access-control-allow-origin"
```

**期望输出**：
```
access-control-allow-origin: http://localhost:5174
```

如果看到这个响应头，说明 CORS 配置成功！

### 2. 在浏览器中测试

1. 打开微信开发者工具
2. 访问 `http://localhost:5174`
3. 点击"测试 API 调用"按钮
4. 应该能成功调用 API，不再出现 CORS 错误

### 3. 查看网络请求

打开浏览器开发者工具 → Network 标签：
- 找到 `/health` 请求
- 查看 Response Headers
- 应该包含：
  ```
  access-control-allow-origin: http://localhost:5174
  access-control-allow-credentials: true
  ```

## 配置说明

### CORS 域名来源

最终允许的域名 = 基础域名 + 环境变量域名

**生产环境基础域名**：
- `https://servicewechat.com`
- `https://*.servicewechat.com`

**环境变量域名**（CORS_ALLOWED_ORIGINS）：
- `http://localhost:5173`
- `http://localhost:5174`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`

### 灵活配置

如果需要添加更多域名，只需修改环境变量：
```
CORS_ALLOWED_ORIGINS=http://localhost:5174,https://your-domain.com,https://another-domain.com
```

多个域名用逗号分隔，修改后重启服务即可，无需重新构建代码。

## 故障排查

### 问题1：部署后仍然有 CORS 错误

**检查清单**：
1. ✓ 环境变量 `CORS_ALLOWED_ORIGINS` 是否存在
2. ✓ 环境变量值是否包含 `http://localhost:5174`
3. ✓ 服务是否已重启（查看启动时间）
4. ✓ 浏览器缓存是否已清除（Ctrl+Shift+R）

**测试命令**：
```bash
# 如果这个命令没有返回 access-control-allow-origin 头
# 说明环境变量未生效或服务未重启
curl -X OPTIONS https://your-backend-url/health \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: GET" \
  -i | grep "access-control-allow-origin"
```

### 问题2：不确定环境变量是否生效

**解决方案**：
1. 登录云托管控制台
2. 进入服务详情 → 配置管理 → 环境变量
3. 确认 `CORS_ALLOWED_ORIGINS` 存在
4. 如果不存在或值不对，添加/修改后重启服务

### 紧急方案：临时允许所有域名

**仅用于调试，不推荐生产使用！**

在云托管环境变量中添加：
```
ALLOW_ALL_ORIGINS=true
```

这会临时允许所有域名访问，用于快速验证 CORS 配置是否生效。确认问题后应该删除此变量，使用正常的域名白名单。

## 文件变更清单

```
elife-backend/
├── src/main.ts                    # CORS 配置逻辑（已修改）
├── .env.production                # 生产环境变量示例（已更新）
├── container.config.json          # 云托管配置（已添加 CORS 环境变量）
├── dist/                          # 构建产物（已重新生成）
├── DEPLOYMENT_GUIDE.md            # 详细部署指南（已更新）
├── CORS_FIX_SUMMARY.md            # 本文档（新建）
└── README.md                      # 项目说明（已更新变更日志）
```

## 关键点总结

1. ✅ **代码已修复**：支持通过环境变量控制 CORS 域名
2. ✅ **配置已准备**：`container.config.json` 包含必要的环境变量
3. ✅ **构建已完成**：dist 目录包含最新代码
4. ⏳ **等待部署**：需要将代码部署到云端
5. ⏳ **验证 CORS**：部署后测试 CORS 响应头

## 下一步行动

**立即执行**：
1. 部署代码到云托管（选择上述方式之一）
2. 等待服务重启
3. 运行验证命令测试 CORS
4. 在浏览器中测试前端调用

**预计时间**：5-10 分钟（视部署方式而定）

---

**创建时间**: 2025-10-11
**维护状态**: ✅ 已验证（本地测试通过）
