import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WechatAuthGuard } from '../auth/guards/wechat-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('用户')
@Controller('user')
@UseGuards(WechatAuthGuard)
@ApiBearerAuth()
export class UserController {
  @Get('login')
  @ApiOperation({ summary: '自动登录接口 - 小程序/公众号打开时调用' })
  getCurrentUser(@CurrentUser() user: User) {
    return user;
  }
}
