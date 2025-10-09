import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpLoggingService } from './http-logging.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [HttpLoggingService],
  exports: [HttpModule, HttpLoggingService],
})
export class GlobalHttpModule {}
