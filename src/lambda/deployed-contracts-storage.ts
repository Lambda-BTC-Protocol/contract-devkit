export interface DeployedContractsStorage {
  get(contractName: string): Promise<string | undefined>;
  set(contractName: string, template: string, block: number): Promise<void>;
  delete(contractName: string): Promise<void>;
}

export class DeployedContractsStorageImpl implements DeployedContractsStorage {
  storage: Map<string, string> = new Map();

  async delete(contractName: string) {
    this.storage.delete(contractName);
  }

  async get(contractName: string): Promise<string | undefined> {
    return this.storage.get(contractName);
  }

  async set(
    contractName: string,
    template: string,
    block: number,
  ): Promise<void> {
    this.storage.set(contractName, template);
  }
}
