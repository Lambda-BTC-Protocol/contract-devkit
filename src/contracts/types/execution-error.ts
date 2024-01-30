export class ExecutionError extends Error {
  constructor(public reason: string) {
    super("execution failed: " + reason);
  }
}
