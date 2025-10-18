import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { ExchangeRateService } from '@modules/common/exchange-rate/exchange-rate.service';
import { QueryOrderDto, CreateOrderDto } from './dto';
import { PaymentStatus, RechargeStatus, RechargeType, Operator } from './enums';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { OperatorAdapter, UnitelAdapter } from './adapters';

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
    const random = nanoid(12); // 从8位增加到12位，降低碰撞风险
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
   * 创建订单（统一接口）
   * 支持话费充值、流量包、账单结算
   */
  async createOrder(openid: string, dto: CreateOrderDto) {
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

      let productCode: string;
      let productName: string;
      let productEngName: string | undefined;
      let priceTg: number;
      let productUnit: number | undefined;
      let productData: string | undefined;
      let productDays: number | undefined;

      // 3. 根据充值类型获取商品信息
      if (dto.rechargeType === RechargeType.POSTPAID) {
        // 后付费：查询账单
        this.logger.log({
          message: '获取后付费账单',
          operator: dto.productOperator,
          phoneNumber: dto.phoneNumber,
        });

        const billInfo = await adapter.getPostpaidBill!(dto.phoneNumber);

        // 验证账单状态
        if (billInfo.invoiceStatus === 'paid') {
          throw new BadRequestException('账单已结清，无需支付');
        }

        if (!billInfo.totalUnpaid || billInfo.totalUnpaid <= 0) {
          throw new BadRequestException('无欠费账单');
        }

        productCode = billInfo.invoiceDate || 'POSTPAID_BILL'; // 账单日期存productCode
        productName = 'Bill Payment';
        priceTg = billInfo.totalUnpaid;
        productData = '0'; // 后付费无流量数据

        this.logger.log({
          message: '账单信息获取成功',
          operator: dto.productOperator,
          totalUnpaid: priceTg,
        });
      } else {
        // 预付费：验证商品
        if (!dto.productCode) {
          throw new BadRequestException('预付费订单必须提供商品代码');
        }

        this.logger.log({
          message: '获取商品信息',
          operator: dto.productOperator,
          phoneNumber: dto.phoneNumber,
          productCode: dto.productCode,
          rechargeType: dto.rechargeType,
        });

        const product = await adapter.validateAndGetProduct(
          dto.productCode,
          dto.phoneNumber,
          dto.rechargeType,
        );

        productCode = product.code;
        productName = product.name;
        productEngName = product.engName;
        priceTg = product.price;
        productUnit = product.unit;
        productData = product.data;
        productDays = product.days;

        this.logger.log({
          message: '商品信息获取成功',
          operator: dto.productOperator,
          productCode,
          productName,
          priceTg,
        });
      }

      // 4. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceRmb = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '汇率计算完成',
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
          productRechargeType: dto.rechargeType,
          productName,
          productEngName,
          productCode,
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productUnit,
          productData,
          productDays,
        },
      });

      this.logger.log({
        message: '订单创建成功',
        orderNumber,
        openid,
        rechargeType: dto.rechargeType,
      });

      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error('创建订单失败', {
        message: err.message,
        stack: err.stack,
        rechargeType: dto.rechargeType,
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

      // 2. 幂等性检查 - 已成功
      if (order.rechargeStatus === RechargeStatus.SUCCESS) {
        this.logger.warn(`订单已充值成功，跳过: ${orderNumber}`);
        return { status: 'already_success' };
      }

      // 3. 使用 updateMany 实现原子性标记（乐观锁）
      // 防止并发重复充值,同时恢复超时卡住的订单
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const updated = await this.prisma.order.updateMany({
        where: {
          orderNumber,
          OR: [
            { rechargeAt: null }, // 原有逻辑：未开始充值
            {
              rechargeAt: { lt: tenMinutesAgo }, // 超时卡住的订单
              seqId: null, // 且未发送充值请求
            },
          ],
        },
        data: {
          rechargeAt: new Date(),
        },
      });

      if (updated.count === 0) {
        this.logger.warn(
          `订单正在被其他进程处理或已处理过，跳过: ${orderNumber}`,
        );
        return { status: 'already_processing' };
      }

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
      let rechargeStatus: RechargeStatus;
      if (result.result === 'success') {
        rechargeStatus = RechargeStatus.SUCCESS;
      } else if (result.result === 'pending') {
        rechargeStatus = RechargeStatus.PENDING;
      } else if (result.result === 'failed') {
        // 明确失败 - 检查是否有seqId
        rechargeStatus = RechargeStatus.FAILED;
        if (!result.seqId) {
          this.logger.warn('充值失败但无seqId，无法查询结果', {
            orderNumber,
            code: result.code,
            msg: result.msg,
          });
        }
      } else {
        // 未知状态，保守处理为失败
        rechargeStatus = RechargeStatus.FAILED;
        this.logger.warn('充值返回未知状态', {
          orderNumber,
          apiResult: result.result,
          code: result.code,
          msg: result.msg,
        });
      }

      await this.prisma.order.update({
        where: { orderNumber },
        data: {
          rechargeStatus,
          seqId: result.seqId || null, // 确保记录seqId
        },
      });

      this.logger.log({
        message: `订单充值${rechargeStatus === RechargeStatus.SUCCESS ? '成功' : rechargeStatus === RechargeStatus.PENDING ? '处理中' : '失败'}`,
        orderNumber,
        operator: order.productOperator,
        rechargeStatus,
        apiResult: result.result,
        apiCode: result.code,
        apiMessage: result.msg,
        seqId: result.seqId,
        phoneNumber: order.phoneNumber,
        productCode: order.productCode,
      });

      return {
        status:
          rechargeStatus === RechargeStatus.SUCCESS
            ? 'success'
            : rechargeStatus === RechargeStatus.PENDING
              ? 'pending'
              : 'failed',
        result,
      };
    } catch (error) {
      // 捕获所有异常，区分超时和其他错误
      const err = error as Error;

      // 判断是否为超时错误
      const isTimeout =
        err.message?.includes('timeout') ||
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNABORTED') ||
        err.message?.includes('timed out');

      const finalStatus = isTimeout
        ? RechargeStatus.TIMEOUT
        : RechargeStatus.FAILED;

      this.logger.error(`订单充值异常: ${orderNumber}`, {
        message: err.message,
        stack: err.stack,
        isTimeout,
        finalStatus,
        orderNumber,
      });

      await this.prisma.order.update({
        where: { orderNumber },
        data: {
          rechargeStatus: finalStatus,
        },
      });

      if (isTimeout) {
        this.logger.error(
          `⚠️ 订单 ${orderNumber} 充值超时，状态标记为TIMEOUT，禁止自动重试，需人工核查是否已充值`,
        );
      }

      return { status: isTimeout ? 'timeout' : 'error', error };
    }
  }
}
