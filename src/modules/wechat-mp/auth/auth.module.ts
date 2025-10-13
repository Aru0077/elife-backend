import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { WechatAuthGuard } from './guards/wechat-auth.guard';

@Module({
  imports: [UserModule],
  providers: [WechatAuthGuard],
  exports: [WechatAuthGuard],
})
export class AuthModule {}
