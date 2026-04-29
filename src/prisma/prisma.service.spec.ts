import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
} from '@jest/globals';

jest.mock('../config/envs', () => ({
  envs: {
    get databaseurl() { return 'mock://test'; },
  },
}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@prisma/client', () => {
  const MockPrismaClient = jest.fn().mockImplementation(function() {
    this.$connect = jest.fn().mockResolvedValue(undefined);
    this.$disconnect = jest.fn().mockResolvedValue(undefined);
    this.$transaction = jest.fn();
  });
  return { PrismaClient: MockPrismaClient };
});

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('PrismaClient methods', () => {
    it('should have $connect method', () => {
      expect(typeof service.$connect).toBe('function');
    });

    it('should have $disconnect method', () => {
      expect(typeof service.$disconnect).toBe('function');
    });

    it('should have $transaction method', () => {
      expect(typeof service.$transaction).toBe('function');
    });
  });
});