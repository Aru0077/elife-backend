import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { sanitizeHeaders, sanitizeBody } from '../utils/sanitize.util';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP-IN');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers, query, params } = req;
    const body: unknown = req.body;
    const startTime = Date.now();

    // 记录请求信息
    this.logger.log({
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
    });

    // 响应完成后记录
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;

      this.logger.log({
        type: 'inbound',
        stage: 'response',
        method,
        url: originalUrl,
        statusCode,
        responseTime: `${responseTime}ms`,
      });
    });

    next();
  }
}
