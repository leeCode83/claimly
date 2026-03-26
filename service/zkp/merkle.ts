import { TREE_DEPTH, TREE_SIZE } from './constants';
import { poseidonHash, poseidonHash2 } from './poseidon';
import { getZeroHashes } from './zero-hashes';
import {
  BuildMerkleTreeInput,
  BuildMerkleTreeOutput,
  GetMerklePathInput,
  GetMerklePathOutput
} from './types';

export async function buildMerkleTree(
  input: BuildMerkleTreeInput
): Promise<BuildMerkleTreeOutput> {
  const { encodings } = input;

  if (encodings.length === 0) {
    throw new Error('Encodings array cannot be empty');
  }

  if (encodings.length > TREE_SIZE) {
    throw new Error(`Encodings count (${encodings.length}) exceeds maximum tree capacity (${TREE_SIZE})`);
  }

  const zeroHashes = await getZeroHashes();

  const leaves: string[] = new Array(TREE_SIZE);

  for (let i = 0; i < TREE_SIZE; i++) {
    if (i < encodings.length) {
      leaves[i] = await poseidonHash(BigInt(encodings[i]));
    } else {
      leaves[i] = zeroHashes[0];
    }
  }

  const levels: string[][] = new Array(TREE_DEPTH + 1);
  levels[0] = leaves;

  for (let level = 1; level <= TREE_DEPTH; level++) {
    const currentLevelSize = TREE_SIZE / Math.pow(2, level);
    levels[level] = new Array(currentLevelSize);

    for (let i = 0; i < currentLevelSize; i++) {
      const left = levels[level - 1][i * 2];
      const right = levels[level - 1][i * 2 + 1];

      if (left === zeroHashes[level - 1] && right === zeroHashes[level - 1]) {
        levels[level][i] = zeroHashes[level];
      } else {
        levels[level][i] = await poseidonHash2(left, right);
      }
    }
  }

  const root = levels[TREE_DEPTH][0];

  const validLeaves = encodings.map((encoding, index) => ({
    index,
    hash: leaves[index],
    encoding
  }));

  return { root, leaves: validLeaves };
}

export async function getMerklePath(
  input: GetMerklePathInput
): Promise<GetMerklePathOutput> {
  const { encoding, allLeafData } = input;

  const zeroHashes = await getZeroHashes();

  const targetLeaf = allLeafData.find(leaf => leaf.encoding === encoding);

  if (!targetLeaf) {
    throw new Error(`Encoding ${encoding} not found in leaf data`);
  }

  const leafIndex = targetLeaf.index;

  const leaves: string[] = new Array(TREE_SIZE);

  for (const leaf of allLeafData) {
    leaves[leaf.index] = leaf.hash;
  }

  for (let i = 0; i < TREE_SIZE; i++) {
    if (!leaves[i]) {
      leaves[i] = zeroHashes[0];
    }
  }

  const levels: string[][] = new Array(TREE_DEPTH + 1);
  levels[0] = leaves;

  for (let level = 1; level <= TREE_DEPTH; level++) {
    const currentLevelSize = TREE_SIZE / Math.pow(2, level);
    levels[level] = new Array(currentLevelSize);

    for (let i = 0; i < currentLevelSize; i++) {
      const left = levels[level - 1][i * 2];
      const right = levels[level - 1][i * 2 + 1];

      if (left === zeroHashes[level - 1] && right === zeroHashes[level - 1]) {
        levels[level][i] = zeroHashes[level];
      } else {
        levels[level][i] = await poseidonHash2(left, right);
      }
    }
  }

  const pathElements: string[] = new Array(TREE_DEPTH);
  const pathIndices: number[] = new Array(TREE_DEPTH);

  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

    pathIndices[level] = isRightNode ? 1 : 0;
    pathElements[level] = levels[level][siblingIndex];

    currentIndex = Math.floor(currentIndex / 2);
  }

  return { pathElements, pathIndices, leafIndex };
}
