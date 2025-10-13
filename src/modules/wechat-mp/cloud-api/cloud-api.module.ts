import { Module } from '@nestjs/common';
import { CloudApiService } from './cloud-api.service';

/**
 * 微信云调用模块
 * 提供微信云托管开放接口服务，免鉴权调用微信API
 */
@Module({
  providers: [CloudApiService],
  exports: [CloudApiService],
})
export class CloudApiModule {}
