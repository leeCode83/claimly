// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createClient } from '@supabase/supabase-js';
import { GenerateProofInput, GenerateProofOutput, VerifyProofInput, VerifyProofOutput } from './types';

const ARTIFACTS_BUCKET = 'zkp-artifacts';
const TEMP_ARTIFACTS_DIR = path.join(os.tmpdir(), 'claimly-zkp-artifacts');

// Initialize Supabase client for storage access. 
// Use SERVICE_ROLE_KEY if available for private bucket access.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

/**
 * Ensures a ZKP artifact is available locally in the temporary directory.
 * Downloads from Supabase Storage if missing.
 */
async function ensureArtifact(fileName: string): Promise<string> {
  const localPath = path.join(TEMP_ARTIFACTS_DIR, fileName);

  if (fs.existsSync(localPath)) {
    return localPath;
  }

  if (!fs.existsSync(TEMP_ARTIFACTS_DIR)) {
    fs.mkdirSync(TEMP_ARTIFACTS_DIR, { recursive: true });
  }

  console.log(`Downloading ZKP artifact: ${fileName}...`);
  const { data, error } = await supabaseAdmin.storage
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
    const wasmPath = await ensureArtifact('insurance_claim.wasm');
    const zkeyPath = await ensureArtifact('insurance_claim.zkey');

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      snarkjsInput,
      wasmPath,
      zkeyPath
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
  const vkeyPath = await ensureArtifact('verification_key.json');
  const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));

  const isValid = await snarkjs.groth16.verify(
    vKey,
    input.publicSignals,
    input.proof
  );

  return { isValid };
}
