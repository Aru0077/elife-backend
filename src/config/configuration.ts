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
    apiUrl: process.env.UNITEL_API_URL || 'https://api.unitel.mn/api/v1',
    username: process.env.UNITEL_USERNAME,
    password: process.env.UNITEL_PASSWORD,
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
});
