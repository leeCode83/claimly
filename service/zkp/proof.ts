// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as snarkjs from 'snarkjs';
import { createClient } from '@supabase/supabase-js';
import { GenerateProofInput, GenerateProofOutput, VerifyProofInput, VerifyProofOutput } from './types';

// Environment detection - check inline or via function for best practice and testability
// const isBrowser = typeof window !== 'undefined';

const ARTIFACTS_BUCKET = 'zkp-artifacts';

/**
 * Supabase client for artifact access.
 * Server-side: uses SERVICE_ROLE_KEY if available for private access (during transitions).
 * Client-side: uses public URL (assuming bucket is public).
 */
const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_SUPABASE_KEY! 
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY!);
  
  return createClient(url, key);
};

const supabase = getSupabaseClient();

/**
 * Returns the URL or local path for a ZKP artifact.
 * Browser: returns the public URL.
 * Node.js: ensures local availability and returns the file path.
 */
async function ensureArtifact(fileName: string): Promise<string> {
  if (typeof window !== 'undefined') {
    const { data } = supabase.storage.from(ARTIFACTS_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  }

  // Node.js specific implementation
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const TEMP_ARTIFACTS_DIR = path.join(os.tmpdir(), 'claimly-zkp-artifacts');
  const localPath = path.join(TEMP_ARTIFACTS_DIR, fileName);

  if (fs.existsSync(localPath)) {
    return localPath;
  }

  if (!fs.existsSync(TEMP_ARTIFACTS_DIR)) {
    fs.mkdirSync(TEMP_ARTIFACTS_DIR, { recursive: true });
  }

  console.log(`Downloading ZKP artifact: ${fileName}...`);
  const { data, error } = await supabase.storage
    .from(ARTIFACTS_BUCKET)
    .download(fileName);

  if (error) {
    throw new Error(`Failed to download ${fileName} from Supabase: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
  console.log(`Successfully cached ${fileName} at ${localPath}`);

  return localPath;
}

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
    const wasmPath = input.artifacts?.wasm_url || await ensureArtifact('insurance_claim.wasm');
    const zkeyPath = input.artifacts?.zkey_url || await ensureArtifact('insurance_claim.zkey');

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      snarkjsInput,
      wasmPath,
      zkeyPath
    );
    return { proof, publicSignals };
  } catch (err) {
    const error = err as Error;
    throw new Error(`Witness generation failed: ${error.message}`);
  }
}

export async function verifyProof(
  input: VerifyProofInput
): Promise<VerifyProofOutput> {
  let vKey: unknown;

  if (typeof window !== 'undefined') {
    const vkeyUrl = await ensureArtifact('verification_key.json');
    vKey = await fetch(vkeyUrl).then(res => res.json());
  } else {
    const fs = await import('fs');
    const vkeyPath = await ensureArtifact('verification_key.json');
    vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
  }

  const isValid = await snarkjs.groth16.verify(
    vKey as any,
    input.publicSignals,
    input.proof
  );

  return { isValid };
}

/**
 * Validates that the public signals from a ZKP proof match the expected data from the request body.
 * This prevents "Parameter Tampering" where a user submits a valid proof for data A 
 * but sends data B in the request body.
 * 
 * Mapping (Groth16/SnarkJS standard for this circuit):
 * [0]: claimAmount
 * [1]: procedureCode
 * [2]: procedureDate (encoded)
 * [3]: approvedDiagnosisRoot
 * [4]: approvedProcedureRoot
 * [5]: maxCoverageAmount
 */
export function validatePublicSignals(
  publicSignals: string[],
  expected: {
    claimAmount: number;
    procedureDate: number; // already encoded YYYYMMDD
    approvedDiagnosisRoot: string;
    approvedProcedureRoot: string;
    maxCoverageAmount: number;
  }
): { isValid: boolean; reason?: string } {
  // console.log('DEBUG: ZKP Public Signals:', publicSignals);
  // console.log('DEBUG: Expected Data:', expected);

  // 0. Check circuit output (out signal) - usually at index 0
  if (BigInt(publicSignals[0]) !== BigInt(1)) {
    return { isValid: false, reason: `Circuit output signal is not 1 (success). Got: ${publicSignals[0]}` };
  }

  // 1. Check procedureDate
  if (BigInt(publicSignals[1]) !== BigInt(expected.procedureDate)) {
    return { isValid: false, reason: `Procedure date mismatch: expected ${expected.procedureDate}, got ${publicSignals[1]}` };
  }

  // 2. Check claimAmount
  if (BigInt(publicSignals[2]) !== BigInt(expected.claimAmount)) {
    return { isValid: false, reason: `Claim amount mismatch: expected ${expected.claimAmount}, got ${publicSignals[2]}` };
  }

  // 3. Check approvedDiagnosisRoot
  if (publicSignals[3] !== expected.approvedDiagnosisRoot) {
    return { isValid: false, reason: `Diagnosis root mismatch: expected ${expected.approvedDiagnosisRoot}, got ${publicSignals[3]}` };
  }

  // 4. Check approvedProcedureRoot
  if (publicSignals[4] !== expected.approvedProcedureRoot) {
    return { isValid: false, reason: `Procedure root mismatch: expected ${expected.approvedProcedureRoot}, got ${publicSignals[4]}` };
  }

  // 5. Check maxCoverageAmount
  if (BigInt(publicSignals[5]) !== BigInt(expected.maxCoverageAmount)) {
    return { isValid: false, reason: `Max coverage mismatch: expected ${expected.maxCoverageAmount}, got ${publicSignals[5]}` };
  }

  return { isValid: true };
}
