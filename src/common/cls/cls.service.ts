import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsyncClient,
  LogItem,
  LogGroup,
  Content,
  PutLogsRequest,
} from 'tencentcloud-cls-sdk-js';

interface LogEntry {
  timestamp: number;
  content: Record<string, unknown>;
}

@Injectable()
export class ClsService {
  private readonly logger = new Logger(ClsService.name);
  private client: AsyncClient | null = null;
  private enabled: boolean;
  private topicId: string;
  private logQueue: LogEntry[] = [];
  private uploadTimer: NodeJS.Timeout | null = null;

  // 批量上传配置
  private readonly BATCH_SIZE = 10; // 每批10条
  private readonly UPLOAD_INTERVAL = 5000; // 5秒上传一次

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('cls.enabled') || false;
    this.topicId = this.configService.get<string>('cls.topicId') || '';

    if (this.enabled) {
      this.initClient();
      this.startUploadTimer();
    }
  }

  private initClient() {
    const secretId = this.configService.get<string>('cls.secretId');
    const secretKey = this.configService.get<string>('cls.secretKey');
    const endpoint = this.configService.get<string>('cls.endpoint');
    const retryTimes = this.configService.get<number>('cls.retryTimes') || 10;

    if (!secretId || !secretKey || !this.topicId || !endpoint) {
      this.logger.warn(
        'CLS配置不完整，跳过初始化（需要 CLS_SECRET_ID, CLS_SECRET_KEY, CLS_ENDPOINT, CLS_TOPIC_ID）',
      );
      this.enabled = false;
      return;
    }

    try {
      this.client = new AsyncClient({
        endpoint,
        secretId,
        secretKey,
        sourceIp: '127.0.0.1', // 可选，自动填充本机IP
        retry_times: retryTimes,
      });

      this.logger.log('CLS客户端初始化成功', {
        endpoint,
        topicId: this.topicId,
        retryTimes,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('CLS客户端初始化失败', {
        message: err.message,
        stack: err.stack,
        endpoint,
        topicId: this.topicId,
      });
      this.enabled = false;
    }
  }

  private startUploadTimer() {
    this.uploadTimer = setInterval(() => {
      void this.flushLogs();
    }, this.UPLOAD_INTERVAL);
  }

  /**
   * 添加日志到队列
   */
  addLog(logContent: string) {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      const content = JSON.parse(logContent) as Record<string, unknown>;
      this.logQueue.push({
        timestamp: Math.floor(Date.now() / 1000),
        content,
      });

      // 如果队列满了，立即上传
      if (this.logQueue.length >= this.BATCH_SIZE) {
        void this.flushLogs();
      }
    } catch {
      // JSON解析失败，忽略
      this.logger.debug('日志内容JSON解析失败，跳过');
    }
  }

  /**
   * 批量上传日志
   */
  private async flushLogs() {
    if (this.logQueue.length === 0 || !this.client) {
      return;
    }

    const logsToUpload = this.logQueue.splice(0, this.BATCH_SIZE);

    try {
      // 创建LogGroup
      const loggroup = new LogGroup();

      // 将每条日志转换为LogItem
      for (const log of logsToUpload) {
        const item = new LogItem();

        // 将日志内容的每个字段作为Content添加
        for (const [key, value] of Object.entries(log.content)) {
          const valueStr =
            typeof value === 'string' ? value : JSON.stringify(value);
          item.pushBack(new Content(key, valueStr));
        }

        item.setTime(log.timestamp);
        loggroup.addLogs(item);
      }

      // 创建上传请求
      const request = new PutLogsRequest(this.topicId, loggroup);

      // 上传日志
      await this.client.PutLogs(request);

      this.logger.debug(`成功上传 ${logsToUpload.length} 条日志到CLS`);
    } catch (error) {
      const err = error as Error;
      this.logger.error('上传日志到CLS失败', {
        message: err.message,
        count: logsToUpload.length,
      });
      // 失败的日志放回队列头部
      this.logQueue.unshift(...logsToUpload);
    }
  }

  /**
   * 应用关闭时清理
   */
  async onModuleDestroy() {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }
    // 上传剩余日志
    await this.flushLogs();
  }
}
