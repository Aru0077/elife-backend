import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';
import { plainToClass } from 'class-transformer';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsOptional()
  WECHAT_APPID = '';

  @IsString()
  @IsOptional()
  WECHAT_MP_APPID = '';

  @IsString()
  @IsOptional()
  LOG_LEVEL = 'info';

  @IsNumber()
  @IsOptional()
  LOG_MAX_FILES = 30;

  // 必需的环境变量
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  UNITEL_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  UNITEL_PASSWORD!: string;

  // 微信支付必需（生产环境）
  @IsString()
  @IsOptional()
  WECHAT_MCH_ID?: string;

  @IsString()
  @IsOptional()
  WECHAT_ENV_ID?: string;
}

export function validate(config: Record<string, unknown>) {
  // 显式转换数字类型的环境变量
  const processedConfig = {
    ...config,
    PORT: config.PORT ? Number(config.PORT) : undefined,
    LOG_MAX_FILES: config.LOG_MAX_FILES
      ? Number(config.LOG_MAX_FILES)
      : undefined,
  };

  const validatedConfig = plainToClass(EnvironmentVariables, processedConfig, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
