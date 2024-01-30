import { TransactionLog } from "@/log";

export class Logger {
  private buffer: TransactionLog[] = [];

  addLog(log: TransactionLog) {
    this.buffer.push(log);
  }

  readLogs(): TransactionLog[] {
    return [...this.buffer];
  }
}
