export class Interface {
    private abi: any[];

    constructor(abi: any[]) {
        this.abi = abi;
    }

    encodeFunctionData(functionName: string, args: any[]): string {
        const functionInfo = this.abi.find(item => item.name === functionName && item.type === 'function');

        if (!functionInfo || !functionInfo.signature) {
            throw new Error(`Function ${functionName} not found in ABI`);
        }

        return `${functionInfo.signature}(${args.join(',')})`; 
    }

    decodeFunctionResult(functionName: string, data: string): any[] {
        // In this simulation, we'll just return the data as is
        // You might need to enhance this for more complex scenarios
        return [data];
    }
}
