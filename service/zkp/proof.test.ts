import { generateProof, verifyProof } from './proof';
import { buildMerkleTree, getMerklePath } from './merkle';
import { poseidonHash2 } from './poseidon';

// --- Mocks ---
jest.mock('snarkjs', () => ({
    groth16: {
        fullProve: jest.fn().mockResolvedValue({ proof: { pi_a: [] }, publicSignals: ['1'] }),
        verify: jest.fn().mockResolvedValue(true)
    }
}));

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('{"verificationKey":"valid"}')
}));

// Mock Supabase to evade direct initialization during imports
const mockDownload = jest.fn();
jest.mock('@supabase/supabase-js', () => {
    return {
        createClient: jest.fn(() => ({
            storage: {
                from: jest.fn(() => ({
                    download: mockDownload
                }))
            }
        }))
    };
});

// Import modules AFTER mocking to hijack inner calls inside the module
import * as snarkjs from 'snarkjs';
import * as fs from 'fs';

describe('ZKP Proof Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateProof', () => {
        const dummyInput = {
            diagnosisCode: 123,
            diagnosisDate: 20240101,
            diagnosisMerklePath: ['hash1', 'hash2'],
            diagnosisPathIndices: [0, 1],
            procedureMerklePath: ['hash3', 'hash4'],
            procedurePathIndices: [0, 1],
            policyStartDate: 20230101,
            policyEndDate: 20250101,
            procedureCode: 456,
            procedureDate: 20240201,
            claimAmount: 50000,
            approvedDiagnosisRoot: 'root1',
            approvedProcedureRoot: 'root2',
            maxCoverageAmount: 1000000
        };

        it('generates proof successfully with local artifacts available', async () => {
            // Mock local cache exists
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            const result = await generateProof(dummyInput);

            expect(fs.existsSync).toHaveBeenCalled(); // checks for wasm and zkey
            expect(mockDownload).not.toHaveBeenCalled(); // Should not download
            expect(snarkjs.groth16.fullProve).toHaveBeenCalled();
            expect(result.proof).toBeDefined();
            expect(result.publicSignals).toBeDefined();
        });

        it('downloads artifacts if they are not cached', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false); // Simulate missing file
            mockDownload.mockResolvedValue({ 
                data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }, 
                error: null 
            });

            const result = await generateProof(dummyInput);

            expect(mockDownload).toHaveBeenCalledTimes(2); // for wasm and zkey
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // saving the files
            expect(snarkjs.groth16.fullProve).toHaveBeenCalled();
            expect(result.proof).toBeDefined();
        });

        it('throws error if download fails', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            mockDownload.mockResolvedValueOnce({ data: null, error: { message: 'Storage Error' } });

            await expect(generateProof(dummyInput)).rejects.toThrow('Storage Error');
        });

        it('throws exception when witness generation fails', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (snarkjs.groth16.fullProve as jest.Mock).mockRejectedValueOnce(new Error('Assert Failed'));

            await expect(generateProof(dummyInput)).rejects.toThrow('Witness generation failed: Assert Failed');
        });
    });

    describe('verifyProof', () => {
        const dummyVerifyInput = {
            proof: { pi_a: ['1'], pi_b: [['1']], pi_c: ['1'], protocol: 'groth16' },
            publicSignals: ['123', '456']
        };

        it('returns true for a valid proof', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            
            const result = await verifyProof(dummyVerifyInput as any);
            
            expect(fs.readFileSync).toHaveBeenCalled(); // reads vkey
            expect(snarkjs.groth16.verify).toHaveBeenCalled();
            expect(result.isValid).toBe(true);
        });
    });

    describe('Merkle Tree', () => {
        it('builds a tree and extracts a valid path', async () => {
            const encodings = [100, 200, 300, 400];
            const { root, leaves } = await buildMerkleTree({ encodings });
            expect(leaves.length).toBe(4);
            
            const targetEncoding = 200;
            const { pathElements, pathIndices, leafIndex } = await getMerklePath({
                encoding: targetEncoding,
                allLeafData: leaves
            });
            
            const targetLeaf = leaves.find(l => l.encoding === targetEncoding);
            expect(targetLeaf).toBeDefined();
            
            let currentHash = targetLeaf!.hash;
            for (let i = 0; i < pathElements.length; i++) {
                const siblingHash = pathElements[i];
                const isRightNode = pathIndices[i] === 1;
                
                if (isRightNode) {
                    currentHash = await poseidonHash2(siblingHash, currentHash);
                } else {
                    currentHash = await poseidonHash2(currentHash, siblingHash);
                }
            }
            
            expect(currentHash).toBe(root);
        });
    });
});
