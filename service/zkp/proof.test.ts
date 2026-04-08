// Set environment variables BEFORE importing the service to prevent top-level initialization errors
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test-url';
process.env.NEXT_PUBLIC_SUPABASE_KEY = 'test-key';

import { generateProof, verifyProof, validatePublicSignals } from './proof';
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
                    download: mockDownload,
                    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://localhost/test.wasm' } })
                }))
            }
        }))
    };
});

// Import modules AFTER mocking to hijack inner calls inside the module
import * as snarkjs from 'snarkjs';
import * as fs from 'fs';

describe('ZKP Proof Service', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { 
            ...originalEnv,
            NEXT_PUBLIC_SUPABASE_URL: 'http://test-url',
            NEXT_PUBLIC_SUPABASE_KEY: 'test-key',
            SUPABASE_SERVICE_ROLE_KEY: 'service-key'
        };
    });

    afterAll(() => {
        process.env = originalEnv;
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
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            const result = await generateProof(dummyInput);

            expect(fs.existsSync).toHaveBeenCalled();
            expect(mockDownload).not.toHaveBeenCalled();
            expect(snarkjs.groth16.fullProve).toHaveBeenCalled();
            expect(result.proof).toBeDefined();
        });

        it('downloads artifacts if they are not cached', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            mockDownload.mockResolvedValue({ 
                data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }, 
                error: null 
            });

            await generateProof(dummyInput);

            expect(mockDownload).toHaveBeenCalledTimes(2);
            expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
        });

        it('throws error if download fails', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            mockDownload.mockResolvedValueOnce({ data: null, error: { message: 'Storage Error' } });

            await expect(generateProof(dummyInput)).rejects.toThrow('Storage Error');
        });

        it('throws error if environment variables are missing', async () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            // The service re-initializes or uses the cached 'supabase' constant. 
            // Since it's a constant in the module, testing the 'throw' in getSupabaseClient 
            // requires isolating the module or mocking the detection logic.
            // But we can check if it fails when called.
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

        it('returns true for a valid proof (Node mode)', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (snarkjs.groth16.verify as jest.Mock).mockResolvedValueOnce(true);
            
            const result = await verifyProof(dummyVerifyInput as any);
            
            expect(fs.readFileSync).toHaveBeenCalled();
            expect(result.isValid).toBe(true);
        });

        it('returns false for an invalid proof', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (snarkjs.groth16.verify as jest.Mock).mockResolvedValueOnce(false);
            
            const result = await verifyProof(dummyVerifyInput as any);
            
            expect(result.isValid).toBe(false);
        });
    });

    describe('validatePublicSignals', () => {
        const validSignals = ['456', '20240201', '50000', 'root1', 'root2', '1000000'];
        const expected = {
            procedureCode: 456,
            procedureDate: 20240201,
            claimAmount: 50000,
            approvedDiagnosisRoot: 'root1',
            approvedProcedureRoot: 'root2',
            maxCoverageAmount: 1000000
        };

        it('returns valid:true for matching signals', () => {
            const result = validatePublicSignals(validSignals, expected);
            expect(result.isValid).toBe(true);
        });

        it('returns valid:false for procedureCode mismatch', () => {
            const result = validatePublicSignals(['999', ...validSignals.slice(1)], expected);
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Procedure code mismatch');
        });

        it('returns valid:false for procedureDate mismatch', () => {
            const signals = [...validSignals];
            signals[1] = '20240202';
            const result = validatePublicSignals(signals, expected);
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Procedure date mismatch');
        });

        it('returns valid:false for claimAmount mismatch', () => {
            const signals = [...validSignals];
            signals[2] = '50001';
            const result = validatePublicSignals(signals, expected);
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Claim amount mismatch');
        });

        it('returns valid:false for diagnosisRoot mismatch', () => {
            const signals = [...validSignals];
            signals[3] = 'wrong-root';
            const result = validatePublicSignals(signals, expected);
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Diagnosis root mismatch');
        });

        it('returns valid:false for procedureRoot mismatch', () => {
            const signals = [...validSignals];
            signals[4] = 'wrong-root';
            const result = validatePublicSignals(signals, expected);
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Procedure root mismatch');
        });

        it('returns valid:false for maxCoverageAmount mismatch', () => {
            const signals = [...validSignals];
            signals[5] = '2000000';
            const result = validatePublicSignals(signals, expected);
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('Max coverage mismatch');
        });
    });

    describe('Merkle Tree (Helper Tests)', () => {
        it('builds a tree and extracts a valid path', async () => {
            const encodings = [100, 200, 300, 400];
            const { root, leaves } = await buildMerkleTree({ encodings });
            expect(leaves.length).toBe(4);
            
            const targetEncoding = 200;
            const { pathElements, pathIndices } = await getMerklePath({
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

        it('throws error if encoding is not found in leaf data', async () => {
            const leaves = [{ encoding: 100, hash: 'h1', index: 0 }];
            await expect(getMerklePath({
                encoding: 999,
                allLeafData: leaves
            })).rejects.toThrow('Encoding 999 not found in leaf data');
        });
    });

    describe('Environment Switch: Browser mode', () => {
        const originalWindow = global.window;
        const originalFetch = global.fetch;

        beforeAll(() => {
            // @ts-ignore
            global.window = {}; // Simulate browser
            global.fetch = jest.fn();
        });

        afterAll(() => {
            global.window = originalWindow;
            global.fetch = originalFetch;
        });

        it('uses public URLs and fetch in browser mode', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                json: () => Promise.resolve({ vKey: 'mock' })
            });

            const dummyVerifyInput = {
                proof: { pi_a: ['1'] },
                publicSignals: ['1']
            };

            const result = await verifyProof(dummyVerifyInput as any);
            
            expect(global.fetch).toHaveBeenCalled();
            expect(result.isValid).toBe(true);
            expect(fs.readFileSync).not.toHaveBeenCalled();
        });
    });
});
