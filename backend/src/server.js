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
  // Force-exit after 10 s so hung DB connections don't block deploys
  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref(); // do not keep the event loop alive for this timer alone

  server.close(async () => {
    try {
      await pool.end();
      logger.info("Database pool closed");
    } catch (err) {
      logger.error("Error closing database pool", { message: err.message });
    }
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
// Catch unhandled promise rejections so the process doesn't crash silently
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: String(reason) });
});
