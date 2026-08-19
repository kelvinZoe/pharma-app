import { NextFunction, Request, Response } from 'express';

interface RateLimitPolicy {
  readonly name: string;
  readonly matches: (path: string, method: string) => boolean;
  readonly max: number;
  readonly windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const POLICIES: readonly RateLimitPolicy[] = [
  {
    name: 'clinic-registration',
    matches: (path, method) => method === 'POST' && path.endsWith('/auth/register-clinic'),
    max: 5,
    windowMs: 60 * 60 * 1000,
  },
  {
    name: 'authentication',
    matches: (path) => /\/auth\/(login|forgot-password|reset-password|complete-invite|verify-invite)$/.test(path),
    max: 20,
    windowMs: 15 * 60 * 1000,
  },
  {
    name: 'financial-reports',
    matches: (path) => path.includes('/reports/'),
    max: 180,
    windowMs: 60 * 1000,
  },
];

export function createRequestRateLimiter() {
  const buckets = new Map<string, Bucket>();

  return (request: Request, response: Response, next: NextFunction): void => {
    const policy = POLICIES.find((candidate) => candidate.matches(request.path, request.method));
    if (!policy) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${policy.name}:${request.ip}`;
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + policy.windowMs }
      : existing;
    bucket.count += 1;
    buckets.set(key, bucket);

    response.setHeader('RateLimit-Limit', String(policy.max));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, policy.max - bucket.count)));
    response.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > policy.max) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      response.status(429).json({ statusCode: 429, message: 'Too many requests. Please try again later.' });
      return;
    }

    if (buckets.size > 5000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}
