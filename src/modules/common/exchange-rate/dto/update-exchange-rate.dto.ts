import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class UpdateExchangeRateDto {
  @IsNotEmpty({ message: '汇率值不能为空' })
  @IsNumber({}, { message: '汇率值必须是数字' })
  @IsPositive({ message: '汇率值必须大于0' })
  rate!: number;
}
