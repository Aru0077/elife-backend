import { Injectable, NestMiddleware, Logger, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { sanitizeHeaders, sanitizeBody } from '../utils/sanitize.util';
import { ClsService } from '../cls/cls.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP-IN');
  private readonly slowThreshold = 500; // 慢请求阈值：500ms

  constructor(@Inject(ClsService) private readonly clsService: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers, query, params } = req;
    const body: unknown = req.body;
    const startTime = Date.now();
    const traceId = nanoid(10); // 生成10位TraceID

    // 将 traceId 挂载到 request 上，便于其他地方使用
    (req as Request & { traceId: string }).traceId = traceId;

    // 记录请求信息
    const requestLog = {
      traceId,
      type: 'inbound',
      stage: 'request',
      method,
      url: originalUrl,
      ip,
      userAgent: headers['user-agent'],
      headers: sanitizeHeaders(headers),
      query,
      params,
      body: sanitizeBody(body),
    };
    this.logger.log(requestLog);
    this.clsService.addLog(JSON.stringify(requestLog));

    // 响应完成后记录
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      const isSlow = responseTime > this.slowThreshold;

      const logData = {
        traceId,
        type: 'inbound',
        stage: 'response',
        method,
        url: originalUrl,
        statusCode,
        responseTime: `${responseTime}ms`,
      };

      // 慢请求使用 warn 级别
      if (isSlow) {
        this.logger.warn({ ...logData, slow: true });
        this.clsService.addLog(JSON.stringify({ ...logData, slow: true }));
      } else {
        this.logger.log(logData);
        this.clsService.addLog(JSON.stringify(logData));
      }
    });

    next();
  }
}
