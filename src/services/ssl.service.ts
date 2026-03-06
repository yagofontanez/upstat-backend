import * as tls from "tls";
import * as https from "https";

export async function checkSSL(url: string): Promise<{
  valid: boolean;
  validUntil: Date | null;
  daysRemaining: number | null;
}> {
  return new Promise((resolve) => {
    try {
      const hostname = new URL(url).hostname;

      const options = {
        host: hostname,
        port: 443,
        rejectUnauthorized: false,
        servername: hostname,
      };

      const socket = tls.connect(options, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.valid_to) {
          return resolve({
            valid: false,
            validUntil: null,
            daysRemaining: null,
          });
        }

        const validUntil = new Date(cert.valid_to);
        const daysRemaining = Math.floor(
          (validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        resolve({
          valid: daysRemaining > 0,
          validUntil,
          daysRemaining,
        });
      });

      socket.on("error", () => {
        resolve({ valid: false, validUntil: null, daysRemaining: null });
      });

      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve({ valid: false, validUntil: null, daysRemaining: null });
      });
    } catch {
      resolve({ valid: false, validUntil: null, daysRemaining: null });
    }
  });
}
