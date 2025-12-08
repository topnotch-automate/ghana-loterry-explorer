import { config } from '../config/index.js';
import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logLevel = (config.logging.level as LogLevel) || 'info';
    
    // Set up log directory and file
    const projectRoot = join(__dirname, '../../..');
    this.logDir = join(projectRoot, 'backend', 'logs');
    this.logFile = join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    
    // Ensure log directory exists
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    let formatted = `${prefix} ${message}`;
    
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (arg instanceof Error) {
          return arg.stack || arg.message;
        }
        return JSON.stringify(arg);
      }).join(' ');
      formatted += ` ${argsStr}`;
    }
    
    return formatted;
  }

  private writeToFile(level: LogLevel, formattedMessage: string, errorDetails?: string): void {
    try {
      const logEntry = formattedMessage + (errorDetails ? '\n' + errorDetails : '') + '\n';
      appendFileSync(this.logFile, logEntry, 'utf-8');
    } catch (err) {
      // If file writing fails, at least log to console
      console.error('Failed to write to log file:', err);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message, ...args);
      console.debug(formatted);
      this.writeToFile('debug', formatted);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message, ...args);
      console.info(formatted);
      this.writeToFile('info', formatted);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, ...args);
      console.warn(formatted);
      this.writeToFile('warn', formatted);
    }
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      const errorDetails = error instanceof Error ? error.stack : (error ? String(error) : undefined);
      const formatted = this.formatMessage('error', message, ...args);
      console.error(formatted, errorDetails ? '\n' + errorDetails : '');
      this.writeToFile('error', formatted, errorDetails);
    }
  }
}

export const logger = new Logger();

