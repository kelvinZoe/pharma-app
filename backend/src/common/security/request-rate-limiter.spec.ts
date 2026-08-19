import { createRequestRateLimiter } from './request-rate-limiter';

describe('request rate limiter', () => {
  it('returns 429 after the authentication limit is exceeded', () => {
    const limiter = createRequestRateLimiter();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();
    const request = { path: '/api/auth/login', method: 'POST', ip: '127.0.0.1' } as any;

    for (let requestNumber = 0; requestNumber < 21; requestNumber += 1) {
      limiter(request, response, next);
    }

    expect(next).toHaveBeenCalledTimes(20);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
  });
});
