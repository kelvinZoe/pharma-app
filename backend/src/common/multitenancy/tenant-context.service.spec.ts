import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  it('keeps unscoped access explicit and isolated', async () => {
    expect(TenantContextService.isUnscopedAllowed()).toBe(false);
    await TenantContextService.runUnscoped(async () => {
      expect(TenantContextService.isUnscopedAllowed()).toBe(true);
      expect(TenantContextService.getTenantId()).toBeUndefined();
    });
    expect(TenantContextService.isUnscopedAllowed()).toBe(false);
  });
});
