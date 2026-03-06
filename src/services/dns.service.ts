import * as dns from "dns";
import { promisify } from "util";

const resolve4 = promisify(dns.resolve4);

export async function checkDNS(url: string): Promise<{
  valid: boolean;
  records: string[];
  error: string | null;
}> {
  try {
    const hostname = new URL(url).hostname;
    const records = await resolve4(hostname);
    return {
      valid: records.length > 0,
      records,
      error: null,
    };
  } catch (err: any) {
    return {
      valid: false,
      records: [],
      error: err.code || "DNS_ERROR",
    };
  }
}
