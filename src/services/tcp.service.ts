import * as net from "net";

export async function checkTCP(
  host: string,
  port: number,
): Promise<{
  alive: boolean;
  latency: number | null;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(5000);

    socket.connect(port, host, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ alive: true, latency });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ alive: false, latency: null });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ alive: false, latency: null });
    });
  });
}
