export enum RechargeStatus {
  PENDING = 'pending', // 等待充值/等待确认结果
  SUCCESS = 'success', // 充值成功
  FAILED = 'failed', // 充值明确失败（有seqId可查询）
  TIMEOUT = 'timeout', // API超时（未知状态，禁止重试）
  UNKNOWN = 'unknown', // 运营商返回不明确状态（已废弃）
}
