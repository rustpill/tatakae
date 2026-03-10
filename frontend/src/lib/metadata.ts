import { PublicKey } from "@solana/web3.js";

export function getCollectionFromMetadata(data: Buffer): { key: PublicKey; verified: boolean } | null {
  try {
    let offset = 1 + 32 + 32;

    const nameLen = data.readUInt32LE(offset);
    offset += 4 + nameLen;

    const symbolLen = data.readUInt32LE(offset);
    offset += 4 + symbolLen;

    const uriLen = data.readUInt32LE(offset);
    offset += 4 + uriLen;

    offset += 2;

    const hasCreators = data[offset];
    offset += 1;
    if (hasCreators) {
      const creatorsLen = data.readUInt32LE(offset);
      offset += 4 + creatorsLen * 34;
    }

    offset += 2;

    const hasEditionNonce = data[offset];
    offset += 1;
    if (hasEditionNonce) offset += 1;

    const hasTokenStandard = data[offset];
    offset += 1;
    if (hasTokenStandard) offset += 1;

    const hasCollection = data[offset];
    offset += 1;
    if (!hasCollection) return null;

    const verified = data[offset] === 1;
    offset += 1;

    const key = new PublicKey(data.subarray(offset, offset + 32));
    return { key, verified };
  } catch {
    return null;
  }
}
