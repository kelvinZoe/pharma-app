import { AuthService } from './auth.service';

describe('AuthService username tenant selection', () => {
  it('refuses an unqualified username when more than one tenant matches', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user-1', username: 'admin', tenantId: 'tenant-1' },
          { id: 'user-2', username: 'admin', tenantId: 'tenant-2' },
        ]),
      },
    } as any;
    const service = new AuthService(prisma, {} as any, {} as any);

    await expect(service.validateUser('admin', 'password')).resolves.toBeNull();
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });
});
