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
import { OrderService } from './order.service';
import { WechatAuthGuard } from '@modules/wechat-mp/auth/guards/wechat-auth.guard';
import { CurrentUser } from '@modules/wechat-mp/auth/decorators/current-user.decorator';
import { User, Prisma } from '@prisma/client';
import {
  QueryOrderDto,
  CreatePrepaidRechargeOrderDto,
  CreateDataPackageOrderDto,
  CreatePostpaidBillOrderDto,
} from './dto';

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
  ): Promise<
    Prisma.OrderGetPayload<{
      include: {
        user: {
          select: {
            openid: true;
            appid: true;
            createdAt: true;
          };
        };
      };
    }>
  > {
    return await this.orderService.findOne(orderNumber, user.openid);
  }

  /**
   * 创建话费充值订单（安全版本）
   */
  @Post('prepaid/recharge')
  @ApiOperation({ summary: '创建话费充值订单' })
  async createPrepaidRecharge(
    @CurrentUser() user: User,
    @Body() dto: CreatePrepaidRechargeOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    return await this.orderService.createPrepaidRechargeOrder(user.openid, dto);
  }

  /**
   * 创建流量包订单（安全版本）
   */
  @Post('prepaid/data-package')
  @ApiOperation({ summary: '创建流量包订单' })
  async createDataPackage(
    @CurrentUser() user: User,
    @Body() dto: CreateDataPackageOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    return await this.orderService.createDataPackageOrder(user.openid, dto);
  }

  /**
   * 创建账单结算订单（安全版本）
   */
  @Post('postpaid/bill-payment')
  @ApiOperation({ summary: '创建账单结算订单' })
  async createPostpaidBill(
    @CurrentUser() user: User,
    @Body() dto: CreatePostpaidBillOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    return await this.orderService.createPostpaidBillOrder(user.openid, dto);
  }
}
