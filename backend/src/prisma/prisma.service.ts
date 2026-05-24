import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as path from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:');
    
    if (isProduction) {
      super();
    } else {
      const baseDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
      const dbPath = path.join(baseDir, 'dev.db');
      const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
      super({ adapter });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
