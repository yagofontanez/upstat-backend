import { PilotStatusClient } from "@pilot-status/sdk";

const client = new PilotStatusClient({ apiKey: process.env.PILOT_API_KEY! });

export async function sendWhatAppDown(
  phone: string,
  monitorName: string,
  url: string,
) {
  try {
    await client.messages.send({
      templateId: process.env.PILOT_DOWN_TEMPLATE!,
      destinationNumber: phone,
      variables: {
        name: monitorName,
        url,
      },
    });
  } catch (e) {
    console.error("[whatsapp] erro ao enviar down alert: ", e);
  }
}

export async function sendWhatsAppUp(
  phone: string,
  monitorName: string,
  url: string,
) {
  try {
    await client.messages.send({
      templateId: process.env.PILOT_UP_TEMPLATE!,
      destinationNumber: phone,
      variables: {
        name: monitorName,
        url,
      },
    });
  } catch (err) {
    console.error("[whatsapp] erro ao enviar up alert:", err);
  }
}
