export interface Config {
  port: number;
  host: string;
  apiKeys: string[];
  claudeTimeout: number;
  claudeModel?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  sessionStorage: {
    type: 'memory' | 'file';
    path?: string;
  };
}
