import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HistoryModule } from './history/history.module';
import { AzureModule } from './azure/azure.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    PrismaModule,
    HistoryModule,
    AzureModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
