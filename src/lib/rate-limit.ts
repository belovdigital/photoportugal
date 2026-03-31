const rateLimit = new Map<string, { count: number; resetTime: number }>();
let callCount = 0;

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + windowMs });
  } else if (entry.count >= maxRequests) {
    return false;
  } else {
    entry.count++;
  }
  if (++callCount % 100 === 0) {
    for (const [k, v] of rateLimit) {
      if (now > v.resetTime) rateLimit.delete(k);
    }
  }
  return true;
}
