/**
 * 日志数据脱敏工具函数
 * 用于清理 HTTP 日志中的敏感信息
 */

/**
 * 敏感 headers 列表
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
];

/**
 * 敏感 body 字段列表
 */
const SENSITIVE_BODY_KEYS = [
  'password',
  'secret',
  'token',
  'apikey',
  'accesstoken',
];

/**
 * 清理敏感 headers
 * @param headers - 原始 headers 对象
 * @returns 脱敏后的 headers
 */
export function sanitizeHeaders(headers: unknown): Record<string, unknown> {
  if (!headers || typeof headers !== 'object') return {};

  const sanitized = { ...headers } as Record<string, unknown>;

  // 隐藏敏感 headers
  SENSITIVE_HEADERS.forEach((key) => {
    if (sanitized[key]) {
      sanitized[key] = '***REDACTED***';
    }
  });

  return sanitized;
}

/**
 * 清理敏感 body 数据
 * @param body - 原始 body 数据
 * @returns 脱敏后的 body
 */
export function sanitizeBody(body: unknown): unknown {
  if (!body) return body;

  // 如果是字符串且太长，截断
  if (typeof body === 'string') {
    return body.length > 1000
      ? body.substring(0, 1000) + '...[truncated]'
      : body;
  }

  // 如果是对象，深拷贝并清理敏感字段
  if (typeof body === 'object') {
    try {
      const sanitized = JSON.parse(JSON.stringify(body)) as Record<
        string,
        unknown
      >;
      redactSensitiveFields(sanitized, SENSITIVE_BODY_KEYS);
      return sanitized;
    } catch {
      return '[Unable to parse body]';
    }
  }

  return body;
}

/**
 * 递归替换敏感字段
 * @param obj - 要处理的对象
 * @param keys - 敏感关键词列表
 */
function redactSensitiveFields(obj: Record<string, unknown>, keys: string[]) {
  for (const key in obj) {
    if (keys.some((k) => key.toLowerCase().includes(k))) {
      obj[key] = '***REDACTED***';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      redactSensitiveFields(obj[key] as Record<string, unknown>, keys);
    }
  }
}
