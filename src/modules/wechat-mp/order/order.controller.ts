import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrderService } from './order.service';
import { WechatAuthGuard } from '@modules/wechat-mp/auth/guards/wechat-auth.guard';
import { CurrentUser } from '@modules/wechat-mp/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { QueryOrderDto, CreateOrderDto } from './dto';

/**
 * 订单 Controller
 * 提供前端用户的订单相关接口
 */
@ApiTags('订单')
@Controller('orders')
@UseGuards(WechatAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 查询我的订单列表
   */
  @Get('my')
  @ApiOperation({ summary: '查询我的订单列表' })
  async findMyOrders(@CurrentUser() user: User, @Query() query: QueryOrderDto) {
    return await this.orderService.findMyOrders(user.openid, query);
  }

  /**
   * 查询订单详情
   */
  @Get(':orderNumber')
  @ApiOperation({ summary: '查询订单详情' })
  async findOne(
    @CurrentUser() user: User,
    @Param('orderNumber') orderNumber: string,
  ) {
    return await this.orderService.findOne(orderNumber, user.openid);
  }

  /**
   * 创建订单（统一接口）
   * 支持话费充值、流量包、账单结算
   * 限流: 每分钟最多10次（防止恶意刷单）
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '创建订单' })
  async createOrder(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return await this.orderService.createOrder(user.openid, dto);
  }
}
