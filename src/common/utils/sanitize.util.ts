/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

      // 限制对象大小，防止日志过大
      const truncated = truncateLargeObject(sanitized, 2048); // 限制2KB

      return truncated;
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

/**
 * 截断超大对象，防止日志过大
 * @param obj - 要处理的对象
 * @param maxBytes - 最大字节数（默认2KB）
 * @returns 截断后的对象
 */
function truncateLargeObject(
  obj: Record<string, unknown>,
  maxBytes: number = 2048,
): Record<string, unknown> | string {
  const jsonStr = JSON.stringify(obj);

  // 如果对象不大，直接返回
  if (jsonStr.length <= maxBytes) {
    return obj;
  }

  // 对象过大，需要截断
  const result: Record<string, unknown> = {};
  let currentSize = 0;

  for (const [key, value] of Object.entries(obj)) {
    // 特殊处理数组：只保留部分元素
    if (Array.isArray(value)) {
      if (value.length > 10) {
        result[key] = [
          ...value.slice(0, 3),
          `...[${value.length - 5} items omitted]...`,
          ...value.slice(-2),
        ];
      } else if (value.length > 5) {
        result[key] = [
          ...value.slice(0, 3),
          `...[${value.length - 3} items omitted]...`,
        ];
      } else {
        result[key] = value;
      }
    }
    // 特殊处理嵌套对象：只保留摘要
    else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      const nestedKeys = Object.keys(value);
      if (nestedKeys.length > 5) {
        result[key] = {
          _summary: `Object with ${nestedKeys.length} keys: ${nestedKeys.slice(0, 3).join(', ')}...`,
        };
      } else {
        result[key] = value;
      }
    }
    // 其他类型直接保留
    else {
      result[key] = value;
    }

    // 检查当前大小
    currentSize = JSON.stringify(result).length;
    if (currentSize > maxBytes) {
      result._truncated = true;
      result._message = `Response too large (${jsonStr.length} bytes), showing summary only`;
      break;
    }
  }

  return result;
}
