import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { UnitelService } from '@modules/wechat-mp/unitel/unitel.service';
import { ExchangeRateService } from '@modules/common/exchange-rate/exchange-rate.service';
import {
  QueryOrderDto,
  CreatePrepaidRechargeOrderDto,
  CreateDataPackageOrderDto,
  CreatePostpaidBillOrderDto,
} from './dto';
import { PaymentStatus, RechargeStatus, RechargeType } from './enums';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import {
  ServiceTypeResponse,
  ServiceCard,
  DataPackage,
} from '@modules/wechat-mp/unitel/dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private unitelService: UnitelService,
    private exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * 生成订单号
   */
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = nanoid(8);
    return `ORD${timestamp}${random}`;
  }

  /**
   * 从资费列表中查找商品
   */
  private findProductByCode(
    serviceData: ServiceTypeResponse,
    productCode: string,
  ): ServiceCard | DataPackage | undefined {
    // 合并所有可能的商品列表
    const allProducts: (ServiceCard | DataPackage)[] = [
      ...(serviceData.service?.cards?.day || []),
      ...(serviceData.service?.cards?.noday || []),
      ...(serviceData.service?.cards?.special || []),
      ...(serviceData.service?.data?.data || []),
      ...(serviceData.service?.data?.days || []),
      ...(serviceData.service?.data?.entertainment || []),
    ];

    return allProducts.find((p) => p.code === productCode);
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

      // 4. 根据充值类型调用不同的 Unitel API
      let result;
      if (order.productRechargeType === (RechargeType.DATA as string)) {
        // 流量包激活
        const dataPackageDto = {
          msisdn: order.phoneNumber,
          package: order.productCode,
          vatflag: '0', // 暂不开发票
          transactions: [
            {
              journal_id: orderNumber,
              amount: order.productPriceTg.toString(),
              description: 'Data Package',
              account: 'WECHAT',
            },
          ],
        };

        this.logger.log({
          message: '调用流量包激活 API',
          orderNumber,
          msisdn: order.phoneNumber,
          package: order.productCode,
          amount: order.productPriceTg.toString(),
        });
        result = await this.unitelService.activateDataPackage(dataPackageDto);
      } else {
        // 话费充值
        const rechargeDto = {
          msisdn: order.phoneNumber,
          card: order.productCode,
          vatflag: '0', // 暂不开发票
          transactions: [
            {
              journal_id: orderNumber,
              amount: order.productPriceTg.toString(),
              description: 'Recharge',
              account: 'WECHAT',
            },
          ],
        };

        this.logger.log({
          message: '调用话费充值 API',
          orderNumber,
          msisdn: order.phoneNumber,
          card: order.productCode,
          amount: order.productPriceTg.toString(),
        });
        result = await this.unitelService.recharge(rechargeDto);
      }

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

      // 2. 调用 Unitel API 获取最新资费列表
      this.logger.log({
        message: '获取最新资费列表',
        msisdn: dto.phoneNumber,
        productCode: dto.productCode,
      });

      const serviceData = await this.unitelService.getServiceTypes({
        msisdn: dto.phoneNumber,
        info: '1', // 获取详细资费信息
      });

      // 3. 从资费列表中查找对应商品
      const product = this.findProductByCode(serviceData, dto.productCode);

      if (!product) {
        throw new BadRequestException(
          `商品代码 ${dto.productCode} 不存在或已下架`,
        );
      }

      // 4. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceTg: number = product.price;
      const priceRmb: number = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '商品信息获取成功',
        productCode: dto.productCode,
        productName: product.name,
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
          productName: product.name,
          productCode: product.code,
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productUnit:
            'unit' in product && product.unit
              ? product.unit.toString()
              : undefined,
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

      // 2. 调用 Unitel API 获取最新资费列表
      this.logger.log({
        message: '获取最新资费列表',
        msisdn: dto.phoneNumber,
        productCode: dto.productCode,
      });

      const serviceData = await this.unitelService.getServiceTypes({
        msisdn: dto.phoneNumber,
        info: '1', // 获取详细资费信息
      });

      // 3. 从资费列表中查找对应商品
      const product = this.findProductByCode(serviceData, dto.productCode);

      if (!product) {
        throw new BadRequestException(
          `商品代码 ${dto.productCode} 不存在或已下架`,
        );
      }

      // 4. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceTg: number = product.price;
      const priceRmb: number = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '商品信息获取成功',
        productCode: dto.productCode,
        productName: product.name,
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
          productName: product.name,
          productCode: product.code,
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productUnit:
            'unit' in product && product.unit
              ? product.unit.toString()
              : undefined,
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

      // 2. 调用 Unitel API 获取后付费账单
      this.logger.log({
        message: '获取后付费账单',
        msisdn: dto.phoneNumber,
      });

      const billData = await this.unitelService.getPostpaidBill({
        owner: dto.phoneNumber,
        msisdn: dto.phoneNumber,
      });

      // 3. 验证账单状态
      if (billData.invoice_status === 'paid') {
        throw new BadRequestException('账单已结清，无需支付');
      }

      if (!billData.total_unpaid || billData.total_unpaid <= 0) {
        throw new BadRequestException('无欠费账单');
      }

      // 4. 获取当前汇率并计算人民币价格
      const exchangeRate =
        await this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
      const priceTg = billData.total_unpaid;
      const priceRmb = Number((priceTg / exchangeRate.rate).toFixed(2));

      this.logger.log({
        message: '账单信息获取成功',
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
          productRechargeType: RechargeType.POSTPAID,
          productName: '后付费账单结算',
          productCode: 'POSTPAID_BILL',
          productPriceTg: priceTg,
          productPriceRmb: priceRmb,
          productData: JSON.stringify({
            invoice_amount: billData.invoice_amount,
            invoice_date: billData.invoice_date,
            invoice_status: billData.invoice_status,
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
