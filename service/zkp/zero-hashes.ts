import { TREE_DEPTH, ZERO_VALUE } from './constants';
import { poseidonHash, poseidonHash2 } from './poseidon';

// Cache array of zero hashes computed once
let cachedZeroHashes: string[] | null = null;

/**
 * Precompute zero hashes for each level in the tree.
 * zeroHashes[0] = Poseidon(0)
 * zeroHashes[1] = Poseidon(zh[0], zh[0])
 * ...
 * zeroHashes[14] = hash of empty subtree of height 14
 */
export async function getZeroHashes(): Promise<string[]> {
  if (cachedZeroHashes !== null) {
    return cachedZeroHashes;
  }

  const zeroHashes: string[] = new Array(TREE_DEPTH);

  // Level 0: Hash of a single empty leaf
  zeroHashes[0] = await poseidonHash(ZERO_VALUE);

  // Levels 1-14: Hash of two empty nodes from previous level
  for (let i = 1; i < TREE_DEPTH; i++) {
    zeroHashes[i] = await poseidonHash2(zeroHashes[i - 1], zeroHashes[i - 1]);
  }

  cachedZeroHashes = zeroHashes;
  return cachedZeroHashes;
}

/**
 * Call this during app startup to precompute hashes before any requests arrive.
 */
export async function initZeroHashes(): Promise<void> {
  await getZeroHashes();
  console.log('[ZKP Service] Zero hashes precomputed and cached.');
}
