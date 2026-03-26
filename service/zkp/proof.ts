// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';
import { GenerateProofInput, GenerateProofOutput, VerifyProofInput, VerifyProofOutput } from './types';

const ARTIFACTS_DIR = path.join(process.cwd(), 'zkp-artifacts');
const WASM_PATH = path.join(ARTIFACTS_DIR, 'insurance_claim.wasm');
const ZKEY_PATH = path.join(ARTIFACTS_DIR, 'insurance_claim.zkey');
const VKEY_PATH = path.join(ARTIFACTS_DIR, 'verification_key.json');

export async function generateProof(
  input: GenerateProofInput
): Promise<GenerateProofOutput> {
  const snarkjsInput = {
    diagnosisCode: input.diagnosisCode.toString(),
    diagnosisDate: input.diagnosisDate.toString(),
    diagnosisMerklePath: input.diagnosisMerklePath,
    diagnosisPathIndices: input.diagnosisPathIndices.map(String),
    procedureMerklePath: input.procedureMerklePath,
    procedurePathIndices: input.procedurePathIndices.map(String),
    policyStartDate: input.policyStartDate.toString(),
    policyEndDate: input.policyEndDate.toString(),
    procedureCode: input.procedureCode.toString(),
    procedureDate: input.procedureDate.toString(),
    claimAmount: input.claimAmount.toString(),
    approvedDiagnosisRoot: input.approvedDiagnosisRoot,
    approvedProcedureRoot: input.approvedProcedureRoot,
    maxCoverageAmount: input.maxCoverageAmount.toString()
  };

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      snarkjsInput,
      WASM_PATH,
      ZKEY_PATH
    );
    return { proof, publicSignals };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(`Witness generation failed: ${error.message}`);
  }
}

export async function verifyProof(
  input: VerifyProofInput
): Promise<VerifyProofOutput> {
  const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf-8'));

  const isValid = await snarkjs.groth16.verify(
    vKey,
    input.publicSignals,
    input.proof
  );

  return { isValid };
}
