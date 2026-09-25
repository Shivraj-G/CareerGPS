import { env } from '../config/env.js';

const levels = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 };
const enabled = (level) => levels[level] <= levels[env.LOG_LEVEL];

function write(level, message, meta = {}) {
  if (!enabled(level)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'fatal') console.error(output);
  else console.log(output);
}

export const logger = {
  fatal: (message, meta) => write('fatal', message, meta),
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta)
};
