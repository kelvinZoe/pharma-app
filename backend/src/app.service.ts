import { Injectable } from '@nestjs/common';
import { getInternetDate } from './common/clock';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'pharma-backend',
      status: 'ok',
      timestamp: getInternetDate().toISOString()
    };
  }
}
