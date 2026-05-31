
// logger.js
const COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m'   // Reset
};

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };


/**
 * Utility class for logging information.
 */
class Logger {
  constructor(pre, minLevel = process.env.LOG_LEVEL) {
    this.minLevel = LOG_LEVELS[minLevel];
    this.pre = pre
  }

  log(level, message, ...args) {
    if (LOG_LEVELS[level] >= this.minLevel) {
      const color = COLORS[level] || '';
      const timestamp = new Date().toISOString();
      const formattedMessage = `${color}[${timestamp}] [${level.toUpperCase()}]${COLORS.reset} ${this.pre} ${message}`;
      console.log(formattedMessage, ...args);
    }
  }

  debug(message, ...args) { this.log('debug', message, ...args); }
  info(message, ...args) { this.log('info', message, ...args); }
  warn(message, ...args) { this.log('warn', message, ...args); }
  error(message, ...args) { this.log('error', message, ...args); }
}

export { Logger };