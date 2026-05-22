import { UserRoleCode } from './session.service';

export const ROLE_LABELS: Record<UserRoleCode, string> = {
  0: 'Admin',
  1: 'Frontdesk',
  2: 'Laboratory',
  3: 'Scanning',
  4: 'Pharmacy',
  5: 'Accounting'
};
