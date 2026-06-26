import pino from "pino";
import path from "path";
import fs from "fs";

const logsDir = path.join(__dirname, "..", "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      levelFirst: true,
      translateTime: true,
      colorize: true,
    }
  }
});

export { logger };
