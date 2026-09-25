import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./config/database.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info("Backend server started", {
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});

async function shutdown(signal) {
  logger.info(`Received ${signal}; shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
