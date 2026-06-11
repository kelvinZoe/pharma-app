import * as https from 'https';

let clockOffset = 0;
let initialized = false;

export async function initInternetTime(): Promise<number> {
  if (initialized) return clockOffset;

  const hosts = ['www.google.com', '1.1.1.1', 'time.cloudflare.com'];

  for (const host of hosts) {
    try {
      const offset = await getOffsetFromHost(host);
      clockOffset = offset;
      initialized = true;
      console.log(`[Clock] Synced with ${host}. Clock offset is ${clockOffset} ms`);
      return clockOffset;
    } catch (err: any) {
      console.warn(`[Clock] Failed to sync with ${host}: ${err?.message}`);
    }
  }

  console.warn('[Clock] All time servers failed. Using local system time.');
  initialized = true;
  return clockOffset;
}

function getOffsetFromHost(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const options: https.RequestOptions = {
      method: 'HEAD',
      host,
      path: '/',
      timeout: 2000,
    };

    const req = https.request(options, (res) => {
      const dateStr = res.headers.date;
      if (dateStr) {
        const internetTime = new Date(dateStr).getTime();
        const duration = Date.now() - start;
        // Adjust for network latency (roughly half round-trip duration)
        const adjustedInternetTime = internetTime + Math.round(duration / 2);
        const offset = adjustedInternetTime - Date.now();
        resolve(offset);
      } else {
        reject(new Error('No Date header'));
      }
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

export function getInternetDate(): Date {
  return new Date(Date.now() + clockOffset);
}
