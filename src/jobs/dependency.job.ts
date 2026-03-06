import cron from "node-cron";
import { checkAllDependencies } from "../services/dependency.service";

export function startDependencyJob() {
  cron.schedule("*/5 * * * *", async () => {
    console.log(`[dependency-job] verificando dependências externas...`);

    try {
      await checkAllDependencies();
    } catch (e) {
      console.error(`[dependency-job] erro ao verificar dependências:`, e);
    }
  });
}
