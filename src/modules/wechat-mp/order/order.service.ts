import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { ExchangeRateService } from '@modules/common/exchange-rate/exchange-rate.service';
import {
  QueryOrderDto,
  CreatePrepaidRechargeOrderDto,
  CreateDataPackageOrderDto,
  CreatePostpaidBillOrderDto,
} from './dto';
import { PaymentStatus, RechargeStatus, RechargeType, Operator } from './enums';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { OperatorAdapter } from './adapters';
import { UnitelAdapter } from './adapters';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly adapters: Map<Operator, OperatorAdapter>;

  constructor(
    private prisma: PrismaService,
    private readonly unitelAdapter: UnitelAdapter,
    private exchangeRateService: ExchangeRateService,
  ) {
    // 初始化运营商适配器映射
    this.adapters = new Map([
      [Operator.UNITEL, this.unitelAdapter],
      // 未来可以添加更多运营商适配器
      // [Operator.MOBICOM, mobicomAdapter],
    ]);
  }

  /**
   * 生成订单号
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = nanoid(8);
    return `ORD${timestamp}${random}`;
  }

  /**
   * 获取运营商适配器
   */
  private getAdapter(operator: Operator): OperatorAdapter {
    const adapter = this.adapters.get(operator);
    if (!adapter) {
      throw new BadRequestException(`不支持的运营商: ${operator}`);
    }
    return adapter;
  }

  /**
   * 查询我的订单列表
   */
  async findMyOrders(openid: string, query: QueryOrderDto) {
    try {
      const {
        page = 1,
        limit = 10,
        paymentStatus,
        rechargeStatus,
        startDate,
        endDate,
      } = query;

      const whereClause: Prisma.OrderWhereInput = { openid };

      // 支付状态过滤
      if (paymentStatus) {
        whereClause.paymentStatus = paymentStatus;
      }

      // 充值状态过滤
      if (rechargeStatus) {
        whereClause.rechargeStatus = rechargeStatus;
      }

      // 日期范围过滤
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          whereClause.createdAt.lte = end;
        }
      }

      // 查询总数
      const total = await this.prisma.order.count({ where: whereClause });

      // 查询订单列表
      const orders = await this.prisma.order.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`查询用户订单列表失败: ${openid}`, {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
  /**
   * 查询订单详情
   */
  async findOne(
    orderNumber: string,
    openid?: string,
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
    try {
      const whereClause: Prisma.OrderWhereUniqueInput = { orderNumber };

      const order = await this.prisma.order.findUnique({
        where: whereClause,
        include: {
          user: {
            select: {
              openid: true,
              appid: true,
              createdAt: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      // 如果指定了 openid，验证订单所有权
      if (openid && order.openid !== openid) {
        throw new NotFoundException('订单不存在');
      }

      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`查询订单失败: ${orderNumber}`, {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 处理微信支付回调（幂等性保护）
   */
  async handleWechatCallback(orderNumber: string): Promise<void> {
    try {
      // 1. 查询订单
      const order = await this.prisma.order.findUnique({
        where: { orderNumber },
      });

      if (!order) {
        this.logger.error(`订单不存在: ${orderNumber}`);
        // 不抛出异常，防止微信无限重试
        return;
      }

      // 2. 如果已经标记为 paid，直接返回成功（幂等性）
      if (order.paymentStatus === (PaymentStatus.PAID as string)) {
        this.logger.warn(`订单已处理（重复回调）: ${orderNumber}`);
        return;
      }

      // 3. 使用 updateMany 实现乐观锁，仅更新 unpaid 状态的订单
      const updated = await this.prisma.order.updateMany({
        where: {
          orderNumber,
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          rechargeStatus: RechargeStatus.PENDING,
        },
      });

      if (updated.count === 0) {
        // 并发情况下，其他请求已经更新了
        this.logger.warn(`订单已被其他请求处理: ${orderNumber}`);
        return;
      }

      // 4. 异步执行充值（不阻塞响应）
      setImmediate(() => {
        this.rechargeOrder(orderNumber).catch((err) => {
          const error = err as Error;
          this.logger.error(`异步充值失败: ${orderNumber}`, {
            message: error.message,
            stack: error.stack,
          });
        });
      });

      this.logger.log(`支付回调处理成功，已触发异步充值: ${orderNumber}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`处理微信回调失败: ${orderNumber}`, {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 执行充值操作（只执行一次，不重试）
   */
  async rechargeOrder(orderNumber: string) {
    try {
      // 1. 查询订单
      const order = await this.prisma.order.findUnique({
        where: { orderNumber },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      // 2. 幂等性检查
      if (order.rechargeStatus === RechargeStatus.SUCCESS) {
        this.logger.warn(`订单已充值成功，跳过: ${orderNumber}`);
        return { status: 'already_success' };
      }

      if (order.rechargeAt) {
        this.logger.warn(`订单已处理过充值，跳过: ${orderNumber}`);
        return { status: 'already_processed' };
      }

      // 3. 标记充值时间（防止重复充值）
      await this.prisma.order.update({
        where: { orderNumber },
        data: {
          rechargeAt: new Date(),
        },
      });

      // 4. 获取运营商适配器并执行充值
      const adapter = this.getAdapter(order.productOperator as Operator);

      this.logger.log({
        message: '开始执行充值',
        orderNumber,
        operator: order.productOperator,
        phoneNumber: order.phoneNumber,
        productCode: order.productCode,
        rechargeType: order.productRechargeType,
      });

      const result = await adapter.recharge(order);

      // 5. 根据充值结果更新订单状态
      const isSuccess = result.result === 'success';
      await this.prisma.order.update({
        where: { orderNumber },
        data: {
          rechargeStatus: isSuccess
            ? RechargeStatus.SUCCESS
            : RechargeStatus.FAILED,
        },
      });

      this.logger.log({
        message: `订单充值${isSuccess ? '成功' : '失败'}`,
        orderNumber,
        operator: order.productOperator,
        rechargeStatus: isSuccess ? 'success' : 'failed',
        apiResult: result.result,
        apiCode: result.code,
        apiMessage: result.msg,
        phoneNumber: order.phoneNumber,
        productCode: order.productCode,
      });

      return { status: isSuccess ? 'success' : 'failed', result };
    } catch (error) {
      // 捕获所有异常，标记为失败
      const err = error as Error;
      this.logger.error(`订单充值异常: ${orderNumber}`, {
        message: err.message,
        stack: err.stack,
      });

      await this.prisma.order.update({
        where: { orderNumber },
        data: {
          rechargeStatus: RechargeStatus.FAILED,
        },
      });

      return { status: 'error', error };
    }
  }

  /**
   * 创建话费充值订单（VOICE）
   * 安全性增强：后端获取最新资费并验证价格
   */
  async createPrepaidRechargeOrder(
    openid: string,
    dto: CreatePrepaidRechargeOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    try {
      // 1. 验证用户是否存在
      const user = await this.prisma.user.findUnique({
        where: { openid },
      });

      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      // 2. 获取运营商适配器
      const adapter = this.getAdapter(dto.productOperator);

      // 3. 通过适配器验证商品并获取商品信息
      this.logger.log({
        message: '获取商品信息',
        operator: dto.productOperator,
        phoneNumber: dto.phoneNumber,
        productCode: dto.productCode,
      });

      const product = await adapter.validateAndGetProduct(
        dto.productCode,
        dto.phoneNumber,
        RechargeType.VOICE,
      );

      // 4. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceTg: number = product.price;
      const priceRmb: number = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '商品信息获取成功',
        operator: dto.productOperator,
        productCode: dto.productCode,
        productName: product.name,
        productEngName: product.engName,
        priceTg,
        priceRmb,
        exchangeRate: exchangeRate.rate,
      });

      // 5. 生成订单号并创建订单
      const orderNumber = this.generateOrderNumber();

      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          openid,
          phoneNumber: dto.phoneNumber,
          productOperator: dto.productOperator,
          productRechargeType: RechargeType.VOICE,
          productName: product.name, // 使用 eng_name || name
          productCode: product.code,
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productUnit: product.unit,
          productData: product.data,
          productDays: product.days,
        },
      });

      this.logger.log(`话费充值订单创建成功: ${orderNumber}, 用户: ${openid}`);
      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error('创建话费充值订单失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 创建流量包订单（DATA）
   * 安全性增强：后端获取最新资费并验证价格
   */
  async createDataPackageOrder(
    openid: string,
    dto: CreateDataPackageOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    try {
      // 1. 验证用户是否存在
      const user = await this.prisma.user.findUnique({
        where: { openid },
      });

      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      // 2. 获取运营商适配器
      const adapter = this.getAdapter(dto.productOperator);

      // 3. 通过适配器验证商品并获取商品信息
      this.logger.log({
        message: '获取商品信息',
        operator: dto.productOperator,
        phoneNumber: dto.phoneNumber,
        productCode: dto.productCode,
      });

      const product = await adapter.validateAndGetProduct(
        dto.productCode,
        dto.phoneNumber,
        RechargeType.DATA,
      );

      // 4. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceTg: number = product.price;
      const priceRmb: number = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '商品信息获取成功',
        operator: dto.productOperator,
        productCode: dto.productCode,
        productName: product.name,
        productEngName: product.engName,
        priceTg,
        priceRmb,
        exchangeRate: exchangeRate.rate,
      });

      // 5. 生成订单号并创建订单
      const orderNumber = this.generateOrderNumber();

      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          openid,
          phoneNumber: dto.phoneNumber,
          productOperator: dto.productOperator,
          productRechargeType: RechargeType.DATA,
          productName: product.name, // 使用 eng_name || name
          productCode: product.code,
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productUnit: product.unit,
          productData: product.data,
          productDays: product.days,
        },
      });

      this.logger.log(`流量包订单创建成功: ${orderNumber}, 用户: ${openid}`);
      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error('创建流量包订单失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 创建账单结算订单（POSTPAID）
   * 安全性增强：后端从账单API获取实际欠费金额
   */
  async createPostpaidBillOrder(
    openid: string,
    dto: CreatePostpaidBillOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    try {
      // 1. 验证用户是否存在
      const user = await this.prisma.user.findUnique({
        where: { openid },
      });

      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      // 2. 获取运营商适配器
      const adapter = this.getAdapter(dto.productOperator);

      // 3. 通过适配器获取后付费账单
      this.logger.log({
        message: '获取后付费账单',
        operator: dto.productOperator,
        phoneNumber: dto.phoneNumber,
      });

      const billInfo = await adapter.getPostpaidBill!(dto.phoneNumber);

      // 4. 验证账单状态
      if (billInfo.invoiceStatus === 'paid') {
        throw new BadRequestException('账单已结清，无需支付');
      }

      if (!billInfo.totalUnpaid || billInfo.totalUnpaid <= 0) {
        throw new BadRequestException('无欠费账单');
      }

      // 5. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceTg = billInfo.totalUnpaid;
      const priceRmb = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '账单信息获取成功',
        operator: dto.productOperator,
        priceTg,
        priceRmb,
        exchangeRate: exchangeRate.rate,
      });

      // 6. 生成订单号并创建订单
      const orderNumber = this.generateOrderNumber();

      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          openid,
          phoneNumber: dto.phoneNumber,
          productOperator: dto.productOperator,
          productRechargeType: RechargeType.POSTPAID,
          productName: 'Postpaid Bill Payment', // 英文账单名称
          productCode: 'POSTPAID_BILL',
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productData: JSON.stringify({
            invoice_amount: billInfo.invoiceAmount,
            invoice_date: billInfo.invoiceDate,
            invoice_status: billInfo.invoiceStatus,
          }),
        },
      });

      this.logger.log(`账单结算订单创建成功: ${orderNumber}, 用户: ${openid}`);
      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error('创建账单结算订单失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}
