import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService security controls', () => {
  const prisma: any = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };
  const emailService: any = { sendStaffInvitation: jest.fn() };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma, emailService);
  });

  it('caps the administrator user directory at 200 rows per request', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    const result = await service.findAll(1, 10_000, '');

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    expect(result).toEqual(expect.objectContaining({ page: 1, limit: 200, total: 0 }));
  });

  it('prevents an administrator from removing their own administrator access', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      fullName: 'Admin User',
      email: 'admin@example.com',
      phone: null,
      role: 0,
      roles: '0',
      module: 'admin',
      isActive: true,
    });

    await expect(service.update('admin-1', { roles: [4] }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents deactivation of the last active administrator', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', role: 0, roles: '0', isActive: true });
    prisma.user.count.mockResolvedValue(0);

    await expect(service.remove('admin-1', 'admin-2')).rejects.toThrow('last active administrator');
  });
});
