export interface BuildMerkleTreeInput {
  encodings: number[];
}

export interface MerkleLeaf {
  index: number;
  hash: string;
  encoding: number;
}

export interface BuildMerkleTreeOutput {
  root: string;
  leaves: MerkleLeaf[];
}

export interface GetMerklePathInput {
  encoding: number;
  allLeafData: MerkleLeaf[];
}

export interface GetMerklePathOutput {
  pathElements: string[];
  pathIndices: number[];
  leafIndex: number;
}

export interface GenerateProofInput {
  diagnosisCode: number;
  diagnosisDate: number;
  diagnosisMerklePath: string[];
  diagnosisPathIndices: number[];
  procedureMerklePath: string[];
  procedurePathIndices: number[];
  policyStartDate: number;
  policyEndDate: number;
  procedureCode: number;
  procedureDate: number;
  claimAmount: number;
  approvedDiagnosisRoot: string;
  approvedProcedureRoot: string;
  maxCoverageAmount: number;
  artifacts?: {
    wasm_url?: string | null;
    zkey_url?: string | null;
  };
}

export interface GenerateProofOutput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proof: any;
  publicSignals: string[];
}

export interface VerifyProofInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proof: any;
  publicSignals: string[];
}

export interface VerifyProofOutput {
  isValid: boolean;
}
