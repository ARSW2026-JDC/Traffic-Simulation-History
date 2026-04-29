import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceBusClient } from '@azure/service-bus';
import { envs } from '../config/envs';

interface HealthCheck {
  status: 'pass' | 'fail';
  latencyMs?: number;
  error?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    const checks = {
      database: await this.checkDatabase(),
      serviceBus: await this.checkServiceBus(),
    };

    const allPass = Object.values(checks).every((c) => c.status === 'pass');

    return {
      status: allPass ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'pass', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'fail',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

    private async checkServiceBus(): Promise<HealthCheck> {
    if (!envs.azureServiceBusConnectionString) {
      return {
        status: 'fail',
        error: 'AZURE_SERVICE_BUS_CONNECTION_STRING not configured',
      };
    }

    const start = Date.now();
    let client: ServiceBusClient | null = null;
    try {
      client = new ServiceBusClient(envs.azureServiceBusConnectionString);
      const receiver = client.createReceiver(
        envs.azureServiceBusTopic,
        'health-check-subscriber',
      );
      await receiver.close();
      return { status: 'pass', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'fail',
        latencyMs: Date.now() - start,
        error: err.message,
      };
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }
}
