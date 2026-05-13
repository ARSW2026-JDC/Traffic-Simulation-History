import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ServiceBusClient,
  ServiceBusReceivedMessage,
  ServiceBusReceiver,
} from '@azure/service-bus';
import { HistoryService } from '../history/history.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuditEvent {
  eventId: string;
  simId: string;
  actor: {
    uid: string;
    name: string;
    avatarUrl?: string;
  };
  commandType: string;
  action: 'add' | 'modify' | 'delete';
  entity: {
    type: 'vehicle' | 'trafficLight';
    id: string;
  };
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  occurredAt: number;
}

@Injectable()
export class AuditConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumerService.name);
  private client: ServiceBusClient | null = null;
  private receiver: ServiceBusReceiver | null = null;

  private readonly connectionString =
    process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
  private readonly topicName =
    process.env.AZURE_SERVICE_BUS_TOPIC || 'simulation-audit';
  private readonly subscriptionName =
    process.env.AZURE_SERVICE_BUS_SUBSCRIPTION || 'audit-consumer';

  constructor(
    private readonly historyService: HistoryService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.connectionString) {
      this.logger.warn(
        'Azure Service Bus not configured. History consumer disabled.',
      );
      return;
    }

    try {
      this.client = new ServiceBusClient(this.connectionString);
      this.receiver = this.client.createReceiver(
        this.topicName,
        this.subscriptionName,
      );
      this.receiver.subscribe({
        processMessage: async (message) => this.handleMessage(message),
        processError: async (args) =>
          this.logger.warn({
            msg: 'Service Bus error',
            error: args.error.message,
          }),
      }, { autoCompleteMessages: false });
    } catch (err) {
      this.logger.error({
        msg: 'Failed to initialize Service Bus consumer',
        error: err.message,
      });
      this.client = null;
      this.receiver = null;
    }
  }

  async onModuleDestroy() {
    if (this.receiver) await this.receiver.close();
    if (this.client) await this.client.close();
  }

  private async handleMessage(message: ServiceBusReceivedMessage) {
    const correlationId = message.messageId;
    const event = this.parseEvent(message);
    if (!event) {
      this.logger.warn({ msg: 'Failed to parse event', correlationId });
      await this.deadLetter(message, 'SchemaValidationFailed', 'Invalid audit payload');
      return;
    }

    if (!event.actor?.uid || !event.actor?.name) {
      this.logger.warn({
        msg: 'Audit event missing actor',
        eventId: event.eventId,
        correlationId,
      });
      await this.deadLetter(message, 'SchemaValidationFailed', 'Missing actor');
      return;
    }

    if (!event.action || !event.entity?.type || !event.entity?.id) {
      this.logger.warn({
        msg: 'Audit event missing entity/action',
        eventId: event.eventId,
        correlationId,
      });
      await this.deadLetter(message, 'SchemaValidationFailed', 'Missing entity or action');
      return;
    }

    await this.ensureUser(event);
    try {
      const entry = await this.historyService.saveAuditEvent(event);
      this.historyService.emitHistory(entry, event.simId);
      await this.receiver?.completeMessage(message);
    } catch (err) {
      if (err?.code === 'P2002') {
        await this.receiver?.completeMessage(message);
        return;
      }
      this.logger.error({
        msg: 'Failed to persist audit event',
        eventId: event.eventId,
        error: err.message,
      });
      await this.deadLetter(message, 'PersistenceFailed', 'Failed to persist audit event');
    }
  }

  private parseEvent(message: ServiceBusReceivedMessage): AuditEvent | null {
    try {
      const payload =
        typeof message.body === 'string'
          ? message.body
          : JSON.stringify(message.body ?? {});
      const parsed = JSON.parse(payload) as AuditEvent;
      if (!parsed?.eventId || !parsed?.simId) return null;
      return parsed;
    } catch (err) {
      this.logger.warn(`Invalid audit message: ${err.message}`);
      return null;
    }
  }

  private async ensureUser(event: AuditEvent) {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: event.actor.uid },
    });
    if (existing) return;

    await this.prisma.user.create({
      data: {
        firebaseUid: event.actor.uid,
        email: `${event.actor.uid}@audit.local`,
        name: event.actor.name,
        avatarUrl: event.actor.avatarUrl || null,
      },
    });
  }

  private async deadLetter(
    message: ServiceBusReceivedMessage,
    reason: string,
    description: string,
  ) {
    try {
      await this.receiver?.deadLetterMessage(message, {
        deadLetterReason: reason,
        deadLetterErrorDescription: description,
      });
    } catch (err) {
      this.logger.warn({
        msg: 'Failed to dead-letter message',
        error: err.message,
      });
    }
  }
}
