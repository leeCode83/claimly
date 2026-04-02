export { buildMerkleTree, getMerklePath } from './merkle';
export { generateProof, verifyProof, validatePublicSignals } from './proof';
export { initZeroHashes } from './zero-hashes';
export type {
  BuildMerkleTreeInput,
  BuildMerkleTreeOutput,
  MerkleLeaf,
  GetMerklePathInput,
  GetMerklePathOutput,
  GenerateProofInput,
  GenerateProofOutput,
  VerifyProofInput,
  VerifyProofOutput
} from './types';
