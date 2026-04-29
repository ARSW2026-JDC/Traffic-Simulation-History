import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

jest.mock('./prisma.service');

describe('PrismaModule', () => {
  let module: TestingModule;
  let prismaServiceMock: any;

  beforeEach(async () => {
    prismaServiceMock = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    (PrismaService as jest.Mock).mockImplementation(() => prismaServiceMock);

    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should provide PrismaService', () => {
    const service = module.get<PrismaService>(PrismaService);
    expect(service).toBeDefined();
  });
});
