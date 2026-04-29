import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

describe('HistoryService', () => {
  let service: HistoryService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      changeLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveChange', () => {
    const mockUser = {
      name: 'Test User',
      email: 'test@example.com',
    };

    const mockChangeLog = {
      id: 'log-1',
      userId: 'user-1',
      simId: 'sim-1',
      entityType: 'vehicle',
      entityId: 'V-001',
      field: 'speed',
      message: 'speed: 20 -> 30',
      timestamp: new Date('2024-01-01T00:00:00Z'),
    };

    it('should create change log entry', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.changeLog.create.mockResolvedValue({
        ...mockChangeLog,
        userId: 'user-1',
      });

      const result = await service.saveChange({
        userId: 'firebase-uid-1',
        simId: 'sim-1',
        entityType: 'vehicle',
        entityId: 'V-001',
        field: 'speed',
        oldValue: '20',
        newValue: '30',
      });

      expect(prismaMock.changeLog.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { firebaseUid: 'firebase-uid-1' } },
          simId: 'sim-1',
          entityType: 'vehicle',
          entityId: 'V-001',
          field: 'speed',
          message: 'speed: 20 -> 30',
        },
      });
      expect(result.entityType).toBe('vehicle');
      expect(result.entityId).toBe('V-001');
    });

    it('should use Unknown when user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.changeLog.create.mockResolvedValue({
        ...mockChangeLog,
        userId: 'unknown',
      });

      const result = await service.saveChange({
        userId: 'unknown-uid',
        simId: 'sim-1',
        entityType: 'vehicle',
        entityId: 'V-001',
        field: 'speed',
        oldValue: '20',
        newValue: '30',
      });

      expect(result.userName).toBe('Unknown');
    });

    it('should handle deleted entities', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.changeLog.create.mockResolvedValue({
        ...mockChangeLog,
        field: 'deleted',
        message: 'deleted:  -> ',
      });

      const result = await service.saveChange({
        userId: 'firebase-uid-1',
        simId: 'sim-1',
        entityType: 'vehicle',
        entityId: 'V-001',
        field: 'deleted',
        oldValue: '',
        newValue: '',
      });

      expect(result.field).toBe('deleted');
    });

    it('should handle created entities', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.changeLog.create.mockResolvedValue({
        ...mockChangeLog,
        field: 'created',
        message: 'created:  -> 1',
      });

      const result = await service.saveChange({
        userId: 'firebase-uid-1',
        simId: 'sim-1',
        entityType: 'vehicle',
        entityId: 'batch',
        field: 'created',
        oldValue: '',
        newValue: '1',
      });

      expect(result.field).toBe('created');
    });
  });

  describe('getHistory', () => {
    const mockLogs = [
      {
        id: 'log-1',
        userId: 'user-1',
        user: { name: 'User 1', email: 'user1@example.com' },
        simId: 'sim-1',
        entityType: 'vehicle',
        entityId: 'V-001',
        field: 'speed',
        message: 'speed: 20 -> 30',
        timestamp: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 'log-2',
        userId: 'user-2',
        user: { name: 'User 2', email: 'user2@example.com' },
        simId: 'sim-1',
        entityType: 'trafficLight',
        entityId: 'TL-001',
        field: 'greenDuration',
        message: 'greenDuration: 30 -> 45',
        timestamp: new Date('2024-01-02T00:00:00Z'),
      },
    ];

    it('should return all history when no simId provided', async () => {
      prismaMock.changeLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getHistory();

      expect(prismaMock.changeLog.findMany).toHaveBeenCalledWith({
        take: 50,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });
      expect(result).toHaveLength(2);
    });

    it('should filter by simId when provided', async () => {
      prismaMock.changeLog.findMany.mockResolvedValue([mockLogs[0]]);

      const result = await service.getHistory(50, undefined, 'sim-1');

      expect(prismaMock.changeLog.findMany).toHaveBeenCalledWith({
        take: 50,
        where: { simId: 'sim-1' },
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });
      expect(result).toHaveLength(1);
    });

    it('should parse oldValue and newValue from message', async () => {
      prismaMock.changeLog.findMany.mockResolvedValue([mockLogs[0]]);

      const result = await service.getHistory();

      expect(result[0].oldValue).toBe('20');
      expect(result[0].newValue).toBe('30');
    });

    it('should handle empty message', async () => {
      prismaMock.changeLog.findMany.mockResolvedValue([
        {
          ...mockLogs[0],
          message: 'created',
        },
      ]);

      const result = await service.getHistory();

      expect(result[0].oldValue).toBe('');
      expect(result[0].newValue).toBe('');
    });

    it('should respect limit parameter', async () => {
      prismaMock.changeLog.findMany.mockResolvedValue([mockLogs[0]]);

      await service.getHistory(10, undefined, 'sim-1');

      expect(prismaMock.changeLog.findMany).toHaveBeenCalledWith({
        take: 10,
        where: { simId: 'sim-1' },
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });
    });

    it('should use user email when name is not available', async () => {
      prismaMock.changeLog.findMany.mockResolvedValue([
        {
          ...mockLogs[0],
          user: { name: null, email: 'user1@example.com' },
        },
      ]);

      const result = await service.getHistory();

      expect(result[0].userName).toBe('user1@example.com');
    });
  });

  describe('emitHistory', () => {
    it('should emit to correct room when wsServer exists', () => {
      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      service.setWsServer(mockServer as any);

      service.emitHistory(
        {
          id: 'log-1',
          userId: 'user-1',
          userName: 'Test User',
          entityType: 'vehicle',
          entityId: 'V-001',
          field: 'speed',
          oldValue: '20',
          newValue: '30',
          timestamp: Date.now(),
        },
        'sim-1',
      );

      expect(mockServer.to).toHaveBeenCalledWith('sim:sim-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'history:new',
        expect.any(Object),
      );
    });

    it('should not emit when wsServer is null', () => {
      const consoleSpy = jest.spyOn(console, 'log');

      service.setWsServer(null as any);
      service.emitHistory(
        {
          id: 'log-1',
          userId: 'user-1',
          userName: 'Test User',
          entityType: 'vehicle',
          entityId: 'V-001',
          field: 'speed',
          oldValue: '20',
          newValue: '30',
          timestamp: Date.now(),
        },
        'sim-1',
      );

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
