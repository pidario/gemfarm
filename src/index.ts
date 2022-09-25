import { PublicKey } from '@solana/web3.js';

export * from './gem-bank';
export * from './gem-farm';
export * from './gem-common';

export const GEM_BANK_PROG_ID = new PublicKey(
  '29j1S79rmS2tthGS6m8n6Cz94QNwuJ62HFmNDJjX6NfE'
);
export const GEM_FARM_PROG_ID = new PublicKey(
  'BXdLcNcVbFHTfumox1qnz85YhVgw36t9CsQFtdQdTGLt'
);
