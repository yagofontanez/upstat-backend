export async function sendSlackAlert(
  webhookUrl: string,
  monitorName: string,
  monitorUrl: string,
  status: "down" | "up",
) {
  const isDown = status === "down";

  const payload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: isDown
            ? `🔴 *${monitorName}* está *offline*`
            : `🟢 *${monitorName}* voltou a ficar *online*`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*URL:* ${monitorUrl} · *UpStat*`,
          },
        ],
      },
    ],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
