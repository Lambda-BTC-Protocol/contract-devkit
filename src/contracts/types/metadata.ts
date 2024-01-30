export type Metadata = {
  blockNumber: number;
  origin: string; // the EOA address of the initiator
  sender: string; // the caller of the function
  currentContract: string; // the current contract of the function (me)
  timestamp: number;
  transactionHash: string;
};
