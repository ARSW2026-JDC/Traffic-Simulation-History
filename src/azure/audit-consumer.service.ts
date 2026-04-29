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
      });
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
      return;
    }

    if (!event.actor?.uid || !event.actor?.name) {
      this.logger.warn({
        msg: 'Audit event missing actor',
        eventId: event.eventId,
        correlationId,
      });
      return;
    }

    await this.ensureUser(event);
    const change = this.mapAuditEvent(event);
    if (!change) {
      this.logger.warn({
        msg: 'Failed to map audit event',
        eventId: event.eventId,
        commandType: event.commandType,
      });
      return;
    }

    try {
      const entry = await this.historyService.saveChange(change);
      this.historyService.emitHistory(entry, event.simId);
    } catch (err) {
      this.logger.error({
        msg: 'Failed to persist audit event',
        eventId: event.eventId,
        error: err.message,
      });
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

  private mapAuditEvent(event: AuditEvent) {
    const { entityType, entityId, field, oldValue, newValue } =
      this.extractChange(event);
    if (!entityType || !entityId || !field) return null;
    return {
      userId: event.actor.uid,
      simId: event.simId,
      entityType,
      entityId,
      field,
      oldValue,
      newValue,
    };
  }

  private extractChange(event: AuditEvent) {
    switch (event.commandType) {
      case 'edit_vehicle': {
        const vehicleId = String(event.payload.vehicleId ?? '');
        const speed = this.toNumber(event.payload.speed);
        const color = this.toString(event.payload.color);
        if (speed !== null) {
          return {
            entityType: 'vehicle',
            entityId: vehicleId,
            field: 'speed',
            oldValue: '',
            newValue: speed.toString(),
          };
        }
        if (color) {
          return {
            entityType: 'vehicle',
            entityId: vehicleId,
            field: 'color',
            oldValue: '',
            newValue: color,
          };
        }
        return {
          entityType: 'vehicle',
          entityId: vehicleId,
          field: 'profile',
          oldValue: '',
          newValue: this.toString(event.payload.profile),
        };
      }
      case 'remove_vehicle': {
        const vehicleId = String(event.payload.vehicleId ?? '');
        return {
          entityType: 'vehicle',
          entityId: vehicleId,
          field: 'deleted',
          oldValue: '',
          newValue: '',
        };
      }
      case 'add_vehicle':
      case 'add_vehicles': {
        const count =
          this.toNumber(event.payload.count ?? event.payload.cantidad) ?? 1;
        return {
          entityType: 'vehicle',
          entityId: 'batch',
          field: 'created',
          oldValue: '',
          newValue: count.toString(),
        };
      }
      case 'remove_trafficLight': {
        const nodeId = this.toString(event.payload.nodeId);
        return {
          entityType: 'trafficLight',
          entityId: nodeId,
          field: 'deleted',
          oldValue: '',
          newValue: '',
        };
      }
      case 'add_traffic_light': {
        return {
          entityType: 'trafficLight',
          entityId: 'new',
          field: 'created',
          oldValue: '',
          newValue: '',
        };
      }
      default:
        return {
          entityType: 'simulation',
          entityId: event.simId,
          field: event.commandType,
          oldValue: '',
          newValue: '',
        };
    }
  }

  private toNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toString(value: unknown) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value))
      return value.toString();
    return '';
  }
}
