import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'pharma-backend',
      status: 'ok',
      timestamp: new Date().toISOString()
    };
  }
}
