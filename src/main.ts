import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe, ConsoleLogger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  // 配置 NestJS 11 JSON Logger
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? new ConsoleLogger({
            json: true,
            colors: false,
            logLevels: ['error', 'warn', 'log'], // 生产环境只输出 error/warn/log，不输出 debug/verbose
          })
        : new ConsoleLogger({
            json: false,
            colors: true,
            logLevels: ['error', 'warn', 'log', 'debug'], // 开发环境包含 debug
          }),
  });

  // 配置 CORS（跨域资源共享）
  // 构建允许的域名列表
  const allowedOrigins: (string | RegExp)[] = [];

  // 生产环境的基础域名
  if (process.env.NODE_ENV === 'production') {
    allowedOrigins.push(
      'https://servicewechat.com',
      'https://*.servicewechat.com',
    );
  }

  // 开发环境的本地域名
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push(
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      /^http:\/\/192\.168\.\d+\.\d+:517[34]$/, // 局域网访问
    );
  }

  // 从环境变量读取额外的允许域名（用逗号分隔）
  if (process.env.CORS_ALLOWED_ORIGINS) {
    const extraOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) =>
      o.trim(),
    );
    allowedOrigins.push(...extraOrigins);
  }

  // 如果没有配置任何域名，允许所有（仅用于紧急情况）
  const corsOrigin =
    allowedOrigins.length > 0
      ? allowedOrigins
      : process.env.ALLOW_ALL_ORIGINS === 'true'
        ? true
        : allowedOrigins;

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Mock-Openid', // 开发环境 Mock openid 头
      'X-WX-OPENID', // 微信 openid 头
      'X-WX-APPID', // 微信 appid 头
      'X-WX-UNIONID', // 微信 unionid 头
      'X-WX-SOURCE', // 微信来源标识头
      'X-WX-FROM-OPENID', // 资源复用场景的 openid
      'X-WX-FROM-APPID', // 资源复用场景的 appid
      'X-WX-FROM-UNIONID', // 资源复用场景的 unionid
    ],
    credentials: true, // 允许发送凭证（cookies、auth headers）
    maxAge: 3600, // 预检请求缓存时间（秒）
  });

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API 文档配置
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('eLife Backend API')
      .setDescription('微信小程序和公众号后端API文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger API Docs: http://localhost:${port}/api`);
  }
}

void bootstrap();
