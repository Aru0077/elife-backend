import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UnitelService } from '../unitel/unitel.service';
import { WechatAuthGuard } from '../auth/guards/wechat-auth.guard';
import { QueryServiceDto } from './dto';

/**
 * 产品 Controller
 * 提供前端查询资费套餐列表的接口
 */
@ApiTags('产品')
@Controller('products')
@UseGuards(WechatAuthGuard)
@ApiBearerAuth()
export class ProductController {
  constructor(private readonly unitelService: UnitelService) {}

  /**
   * 查询资费列表
   * 前端调用此接口获取可购买的充值套餐
   */
  @Post('services')
  @ApiOperation({ summary: '查询资费套餐列表' })
  async getServiceTypes(@Body() dto: QueryServiceDto) {
    return await this.unitelService.getServiceTypes(dto);
  }
}
