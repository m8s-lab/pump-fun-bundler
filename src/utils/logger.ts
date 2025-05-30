import * as log4js from "log4js";
// Function to generate log file names based on a prefix
function generateLogFileName(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  // const hours = String(now.getHours()).padStart(2, '0');
  // const minutes = String(now.getMinutes()).padStart(2, '0');
  // const seconds = String(now.getSeconds()).padStart(2, '0');
  // Return the formatted file name
  return `logs/${prefix}/${prefix}-${year}-${month}-${day}.txt`;
}

// Export loggers using CommonJS syntax
export const defaultLogger = log4js.configure({
  appenders: {
    console: { type: 'console' },
    info: { type: 'file', filename: generateLogFileName('info') },
    log: { type: 'file', filename: generateLogFileName('log') },
    error: { type: 'file', filename: generateLogFileName('error') }
  },
  categories: {
    default: { appenders: ['console'], level: 'debug' },
    info: { appenders: ['info'], level: 'info' },
    log: { appenders: ['log'], level: 'debug' },
    error: { appenders: ['error'], level: 'error' }
  }
}).getLogger();

export const infoLogger = log4js.configure({
  appenders: {
    console: { type: 'console' },
    info: { type: 'file', filename: generateLogFileName('info') },
    log: { type: 'file', filename: generateLogFileName('log') },
    error: { type: 'file', filename: generateLogFileName('error') }
  },
  categories: {
    default: { appenders: ['console'], level: 'debug' },
    info: { appenders: ['info'], level: 'info' },
    log: { appenders: ['log'], level: 'debug' },
    error: { appenders: ['error'], level: 'error' }
  }
}).getLogger('info');

export const logLogger = log4js.configure({
  appenders: {
    console: { type: 'console' },
    info: { type: 'file', filename: generateLogFileName('info') },
    log: { type: 'file', filename: generateLogFileName('log') },
    error: { type: 'file', filename: generateLogFileName('error') }
  },
  categories: {
    default: { appenders: ['console'], level: 'debug' },
    info: { appenders: ['info'], level: 'info' },
    log: { appenders: ['log'], level: 'debug' },
    error: { appenders: ['error'], level: 'error' }
  }
}).getLogger('log');

export const errorLogger = log4js.configure({
  appenders: {
    console: { type: 'console' },
    info: { type: 'file', filename: generateLogFileName('info') },
    log: { type: 'file', filename: generateLogFileName('log') },
    error: { type: 'file', filename: generateLogFileName('error') }
  },
  categories: {
    default: { appenders: ['console'], level: 'debug' },
    info: { appenders: ['info'], level: 'info' },
    log: { appenders: ['log'], level: 'debug' },
    error: { appenders: ['error'], level: 'error' }
  }
}).getLogger('error');
