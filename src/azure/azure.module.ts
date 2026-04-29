import { Module } from '@nestjs/common';
import { AuditConsumerService } from './audit-consumer.service';
import { HistoryModule } from '../history/history.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HistoryModule, PrismaModule],
  providers: [AuditConsumerService],
})
export class AzureModule {}
