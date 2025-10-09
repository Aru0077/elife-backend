import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WechatAuthGuard } from '../auth/guards/wechat-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('用户')
@Controller('users')
@UseGuards(WechatAuthGuard)
@ApiBearerAuth()
export class UserController {
  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  getCurrentUser(@CurrentUser() user: User) {
    return user;
  }
}
