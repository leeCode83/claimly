// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { buildPoseidon } from 'circomlibjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let poseidonInstance: any = null;

async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

export async function poseidonHash(value: bigint): Promise<string> {
  const poseidon = await getPoseidon();
  const result = poseidon([value]);
  return poseidon.F.toString(result);
}

export async function poseidonHash2(left: string, right: string): Promise<string> {
  const poseidon = await getPoseidon();
  const result = poseidon([BigInt(left), BigInt(right)]);
  return poseidon.F.toString(result);
}

export async function poseidonHashArray(inputs: bigint[]): Promise<string> {
  const poseidon = await getPoseidon();
  const result = poseidon(inputs);
  return poseidon.F.toString(result);
}
