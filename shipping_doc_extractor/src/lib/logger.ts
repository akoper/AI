export type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "step";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  stage: string;
  message: string;
  details?: any;
}

// In-memory circular buffer for recent logs so frontend UI can follow along
const MAX_LOGS = 300;
const logBuffer: LogEntry[] = [];

// ANSI color codes for terminal formatting
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  // Colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  brightCyan: "\x1b[96m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  bgBlue: "\x1b[44m",
  bgCyan: "\x1b[46m",
  bgGreen: "\x1b[42m",
  bgDark: "\x1b[100m",
};

export const logger = {
  banner(title: string, subtitle?: string) {
    const bar = "=".repeat(68);
    console.log(`\n${c.cyan}${c.bold}${bar}${c.reset}`);
    console.log(`${c.brightCyan}${c.bold}  >> ${title.toUpperCase()} <<${c.reset}`);
    if (subtitle) {
      console.log(`${c.gray}     ${subtitle}${c.reset}`);
    }
    console.log(`${c.cyan}${c.bold}${bar}${c.reset}\n`);

    this.log("step", "PIPELINE", title, subtitle);
  },

  log(level: LogLevel, stage: string, message: string, details?: any) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      level,
      stage,
      message,
      details,
    };

    // Add to circular buffer for frontend streaming
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift();
    }

    // Terminal formatting
    const time = new Date().toLocaleTimeString();
    let badge = "";

    switch (level) {
      case "step":
        badge = `${c.bgBlue}${c.white}${c.bold} [STEP] ${c.reset}`;
        break;
      case "info":
        badge = `${c.cyan}${c.bold} [INFO] ${c.reset}`;
        break;
      case "success":
        badge = `${c.brightGreen}${c.bold} [SUCCESS] ${c.reset}`;
        break;
      case "warn":
        badge = `${c.brightYellow}${c.bold} [WARNING] ${c.reset}`;
        break;
      case "error":
        badge = `${c.red}${c.bold} [ERROR] ${c.reset}`;
        break;
      case "debug":
        badge = `${c.gray} [DEBUG] ${c.reset}`;
        break;
    }

    const stageTag = stage ? `${c.brightMagenta}[${stage.padEnd(14)}]${c.reset}` : "";
    console.log(`${c.gray}${time}${c.reset} ${badge} ${stageTag} ${message}`);

    if (details !== undefined && details !== null) {
      if (typeof details === "object") {
        try {
          const formatted = JSON.stringify(details, null, 2)
            .split("\n")
            .map((line) => `    ${c.gray}${line}${c.reset}`)
            .join("\n");
          console.log(formatted);
        } catch {
          console.log(`    ${c.gray}${details}${c.reset}`);
        }
      } else {
        console.log(`    ${c.gray}↳ ${details}${c.reset}`);
      }
    }
  },

  step(stage: string, message: string, details?: any) {
    this.log("step", stage, message, details);
  },

  info(stage: string, message: string, details?: any) {
    this.log("info", stage, message, details);
  },

  success(stage: string, message: string, details?: any) {
    this.log("success", stage, message, details);
  },

  warn(stage: string, message: string, details?: any) {
    this.log("warn", stage, message, details);
  },

  error(stage: string, message: string, details?: any) {
    this.log("error", stage, message, details);
  },

  debug(stage: string, message: string, details?: any) {
    this.log("debug", stage, message, details);
  },

  getRecentLogs(limit: number = 100): LogEntry[] {
    return logBuffer.slice(-limit);
  },

  clearLogs(): void {
    logBuffer.length = 0;
  },
};
