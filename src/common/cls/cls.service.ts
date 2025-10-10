import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tencentcloud from 'tencentcloud-sdk-nodejs-cls';

const ClsClient = tencentcloud.cls.v20201016.Client;

interface LogItem {
  timestamp: number;
  content: string;
}

@Injectable()
export class ClsService {
  private readonly logger = new Logger(ClsService.name);
  private client: typeof ClsClient.prototype | null = null;
  private enabled: boolean;
  private topicId: string;
  private logQueue: LogItem[] = [];
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
    const region = this.configService.get<string>('cls.region');

    if (!secretId || !secretKey || !this.topicId) {
      this.logger.warn(
        'CLS配置不完整，跳过初始化（需要 CLS_SECRET_ID, CLS_SECRET_KEY, CLS_TOPIC_ID）',
      );
      this.enabled = false;
      return;
    }

    try {
      this.client = new ClsClient({
        credential: {
          secretId,
          secretKey,
        },
        region,
        profile: {
          httpProfile: {
            endpoint: 'cls.tencentcloudapi.com',
          },
        },
      });

      this.logger.log('CLS客户端初始化成功');
    } catch (error) {
      const err = error as Error;
      this.logger.error('CLS客户端初始化失败', {
        message: err.message,
        stack: err.stack,
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

    this.logQueue.push({
      timestamp: Date.now(),
      content: logContent,
    });

    // 如果队列满了，立即上传
    if (this.logQueue.length >= this.BATCH_SIZE) {
      void this.flushLogs();
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
      // CLS SDK UploadLog 参数格式
      const params = {
        TopicId: this.topicId,
        HashKey: 'elife-backend',
      };

      // 直接使用SDK方法
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.client as any).UploadLog(params);

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
