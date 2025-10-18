export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  wechat: {
    // 小程序配置（仅用于标识，云托管环境自动处理认证）
    miniprogram: {
      appid: process.env.WECHAT_APPID,
    },
    // 公众号配置（仅用于标识，云托管环境自动处理认证）
    mp: {
      appid: process.env.WECHAT_MP_APPID,
    },
    // 微信支付配置
    payment: {
      mchId: process.env.WECHAT_MCH_ID, // 子商户号
      envId: process.env.WECHAT_ENV_ID, // 云托管环境ID
      callbackService:
        process.env.WECHAT_PAYMENT_CALLBACK_SERVICE || 'elife-backend', // 回调服务名
      callbackPath:
        process.env.WECHAT_PAYMENT_CALLBACK_PATH || '/payment/callback', // 回调路径（不含订单号）
      serverIp: process.env.WECHAT_PAYMENT_SERVER_IP || '127.0.0.1', // 服务器IP
    },
  },

  unitel: {
    // Unitel API 配置
    // 注意: UNITEL_API_URL 必须在 .env 中配置
    apiUrl: process.env.UNITEL_API_URL || 'https://api.unitel.mn/api/v1',
    username: process.env.UNITEL_USERNAME,
    password: process.env.UNITEL_PASSWORD,
    // API 超时配置（毫秒）
    timeout: parseInt(process.env.UNITEL_TIMEOUT || '30000', 10),
    // Token 缓存时间（秒）
    tokenCacheTime: parseInt(process.env.UNITEL_TOKEN_CACHE_TIME || '90', 10),
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '30', 10),
  },

  cls: {
    enabled: process.env.CLS_ENABLED === 'true',
    secretId: process.env.CLS_SECRET_ID,
    secretKey: process.env.CLS_SECRET_KEY,
    endpoint: process.env.CLS_ENDPOINT || 'ap-shanghai.cls.tencentyun.com',
    topicId: process.env.CLS_TOPIC_ID,
    retryTimes: parseInt(process.env.CLS_RETRY_TIMES || '10', 10),
  },

  // 数据库配置
  database: {
    // 连接重试配置
    maxRetries: parseInt(process.env.DB_MAX_RETRIES || '5', 10),
    retryDelay: parseInt(process.env.DB_RETRY_DELAY || '5000', 10),
  },

  // 业务配置
  recharge: {
    // 充值重试配置
    maxAttempts: parseInt(process.env.RECHARGE_RETRY_MAX_ATTEMPTS || '3', 10),
    delayMs: parseInt(process.env.RECHARGE_RETRY_DELAY_MS || '5000', 10),
  },

  // 定时任务配置
  task: {
    retryPending: process.env.TASK_RETRY_PENDING_ENABLED !== 'false',
    checkFailed: process.env.TASK_CHECK_FAILED_ENABLED !== 'false',
    checkTransaction: process.env.TASK_CHECK_TRANSACTION_ENABLED !== 'false',
  },
});
