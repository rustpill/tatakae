import { Keypair } from "@solana/web3.js";

export function buildWallet(keypair: Keypair) {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof (await import("@solana/web3.js")).Transaction) tx.sign(keypair);
      return tx;
    },
    signAllTransactions: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]): Promise<T[]> => {
      const { Transaction } = await import("@solana/web3.js");
      return txs.map((tx) => {
        if (tx instanceof Transaction) tx.sign(keypair);
        return tx;
      });
    },
  };
}