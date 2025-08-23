export interface AppConfig {
  port: number;
  nodeEnv: string;
  requireOpenAiKey: boolean;
  logLevel: string;
  corsOrigin: string;
}

export interface LoggerConfig {
  level: string;
  format: string;
  transports: string[];
}