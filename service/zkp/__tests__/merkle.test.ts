import { buildMerkleTree, getMerklePath } from '../merkle';
import { poseidonHash2 } from '../poseidon';

async function runTest() {
  console.log('--- Testing Merkle Tree Implementation ---');

  // Dummy encoding array
  const encodings = [100, 200, 300, 400];
  console.log('1. Building Merkle tree for encodings:', encodings);
  
  const buildStart = Date.now();
  const { root, leaves } = await buildMerkleTree({ encodings });
  console.log(`[+] Build complete in ${Date.now() - buildStart}ms`);
  console.log(`[+] Root Hash:`, root);
  console.log(`[+] Valid Leaves count:`, leaves.length);

  // Pick one encoding to extract path
  const targetEncoding = 200;
  console.log(`\n2. Extracting Merkle path for encoding:`, targetEncoding);
  
  const pathStart = Date.now();
  const { pathElements, pathIndices, leafIndex } = await getMerklePath({
    encoding: targetEncoding,
    allLeafData: leaves
  });
  console.log(`[+] Path extraction complete in ${Date.now() - pathStart}ms`);
  console.log(`[+] Leaf Index:`, leafIndex);
  console.log(`[+] Path Elements count:`, pathElements.length);
  
  // Reconstruct root manually to verify consistency
  console.log(`\n3. Verifying path consistency...`);
  
  const targetLeaf = leaves.find(l => l.encoding === targetEncoding);
  if (!targetLeaf) throw new Error('Target leaf not found');
  
  let currentHash = targetLeaf.hash;
  for (let i = 0; i < pathElements.length; i++) {
    const siblingHash = pathElements[i];
    const isRightNode = pathIndices[i] === 1;
    
    if (isRightNode) {
      currentHash = await poseidonHash2(siblingHash, currentHash);
    } else {
      currentHash = await poseidonHash2(currentHash, siblingHash);
    }
  }
  
  console.log(`[+] Reconstructed Root:`, currentHash);
  if (currentHash === root) {
    console.log(`[✅] SUCCESS! Reconstructed root matches the tree root.`);
  } else {
    console.log(`[❌] ERROR! Reconstructed root does NOT match the tree root.`);
  }
}

runTest().catch(console.error);
