import 'jest';
import fs from 'fs';
import path from 'path';
import redis from '../lib/redis';

// Load .env manual for integration test environment
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    envLines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^"|"$/g, '');
                process.env[key.trim()] = value;
            }
        }
    });
}

/**
 * Integration test for the main flow of the Claimly project.
 * This test simulates a real end-to-end scenario from user registration to claim approval.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Helper for API calls
async function apiRequest(endpoint: string, method: string = 'GET', body: Record<string, unknown> | null = null, token: string | null = null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let url = `${BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (method === 'GET' || method === 'HEAD') {
      const params = new URLSearchParams();
      for (const key in body) {
        if (body[key] !== undefined && body[key] !== null) {
          params.append(key, String(body[key]));
        }
      }
      url += `?${params.toString()}`;
    } else {
      options.body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, options);

  const data = await response.json();
  if (!response.ok) {
    return { status: response.status, data, errorMsg: data.error || data.message || JSON.stringify(data) };
  }
  return { status: response.status, data };
}

describe('Claimly Integration Flow', () => {
  // Fail-fast mechanism: skip subsequent tests if one fails
  let previousTestFailed = false;

  beforeEach(() => {
    if (previousTestFailed) {
      throw new Error('Skipping test due to previous failure (Fail-Fast)');
    }
  });

  afterEach(() => {
    const state = (expect as unknown as { getState: () => { error?: Error } }).getState();
    if (state.error) {
      previousTestFailed = true;
    }
  });

  // Authentication data
  const staffCredentials = {
    email: 'ale.staff@rs-sehat.com',
    password: 'password123',
  };

  const reviewerCredentials = {
    email: 'budil@gmail.com',
    password: 'password123',
  };

  const newPatientUser = {
    email: `test.patient.${Date.now()}@example.com`,
    password: 'password123',
    full_name: 'Test New Patient',
    role: 'patient',
  };

  // State variables to store tokens and IDs
  let staffToken: string;
  let reviewerToken: string;
  let patientUserToken: string;

  let policyId: string;
  let patientId: string;
  let patientPolicyId: string;
  let medicalRecordId: string;
  let claimId: string;
  let newPatientUserId: string;

  // Master data
  let diagnosisCodes: string[] = [];
  let diagnosisIds: string[] = [];
  let procedureCodes: string[] = [];
  let procedureIds: string[] = [];

  // Set timeout to 60s as ZKP proof generation can be slow
  jest.setTimeout(60000);

  /**
   * Phase 1: Authentication & Setup
   */
  test('should register a new patient user', async () => {
    const { status, data } = await apiRequest('/api/auth/signup', 'POST', newPatientUser);
    expect(status).toBe(201);
    expect(data.data.user).toBeDefined();
    newPatientUserId = data.data.user.id;
  });

  test('should login as the new patient', async () => {
    const { status, data } = await apiRequest('/api/auth/signin', 'POST', {
      email: newPatientUser.email,
      password: newPatientUser.password,
    });
    expect(status).toBe(200);
    expect(data.data.session?.access_token).toBeDefined();
    patientUserToken = data.data.session.access_token;
  });

  test('should login as hospital_staff', async () => {
    const { status, data } = await apiRequest('/api/auth/signin', 'POST', staffCredentials);
    expect(status).toBe(200);
    expect(data.data.session?.access_token).toBeDefined();
    staffToken = data.data.session.access_token;
  });

  test('should login as insurance_reviewer', async () => {
    const { status, data } = await apiRequest('/api/auth/signin', 'POST', reviewerCredentials);
    expect(status).toBe(200);
    expect(data.data.session?.access_token).toBeDefined();
    reviewerToken = data.data.session.access_token;
  });

  /**
   * Phase 2: Insurance Setup (Insurance Reviewer)
   */
  test('should fetch master data for diagnoses and procedures', async () => {
    const diagRes = await apiRequest('/api/policies/diagnoses', 'GET', null, reviewerToken);
    expect(diagRes.status).toBe(200);
    expect(diagRes.data.data.length).toBeGreaterThan(0);
    const diagData = diagRes.data.data.slice(0, 5) as Array<{ icd10_code: string; id: string }>;
    diagnosisCodes = diagData.map((d) => d.icd10_code);
    diagnosisIds = diagData.map((d) => d.id);

    const procRes = await apiRequest('/api/policies/procedures', 'GET', null, reviewerToken);
    expect(procRes.status).toBe(200);
    expect(procRes.data.data.length).toBeGreaterThan(0);
    const procData = procRes.data.data.slice(0, 5) as Array<{ icd9_code: string; id: string }>;
    procedureCodes = procData.map((p) => p.icd9_code);
    procedureIds = procData.map((p) => p.id);
  });

  test('should create a new insurance policy template', async () => {
    const policyPayload = {
      policy_name: `Integration Test Policy ${Date.now()}`,
      max_coverage_amount: 50000000,
      valid_from: '2024-01-01',
      valid_until: '2027-12-31',
      diagnosis_codes: diagnosisCodes,
      procedure_codes: procedureCodes,
    };

    const { status, data } = await apiRequest('/api/policies', 'POST', policyPayload, reviewerToken);
    
    expect(status).toBe(201);
    expect(data.data.id).toBeDefined();
    policyId = data.data.id;
  });

  /**
   * Phase 3: Hospital Workflow (Hospital Staff)
   */
  test('should register the new user as a patient', async () => {
    const patientPayload = {
      nik: `NIK${Date.now()}`,
      full_name: newPatientUser.full_name,
      birth_year: 1995,
      gender: 'M',
      user_id: newPatientUserId,
    };

    const { status, data, errorMsg } = await apiRequest('/api/patients', 'POST', patientPayload, staffToken);
    if (status !== 201) throw new Error(`Patient registration failed: ${errorMsg}`);
    expect(data.data.id).toBeDefined();
    patientId = data.data.id;
  });

  test('should assign the insurance policy to the patient', async () => {
    const patientPolicyPayload = {
      policy_id: policyId,
      policy_number: `POL-${Date.now()}`,
      start_date: '2024-01-01',
      end_date: '2026-12-31',
    };

    const { status, data, errorMsg } = await apiRequest(`/api/patients/${patientId}/policies`, 'POST', patientPolicyPayload, staffToken);
    if (status !== 201) throw new Error(`Patient policy assignment failed: ${errorMsg}`);
    expect(data.data.id).toBeDefined();
    patientPolicyId = data.data.id;
  });

  test('should create a medical record for the patient', async () => {
    const mrPayload = {
      patient_id: patientId,
      diagnosis_id: diagnosisIds[0],
      diagnosis_date: '2026-01-15',
      notes: 'Testing integration flow creation',
    };

    const { status, data, errorMsg } = await apiRequest('/api/medical-records', 'POST', mrPayload, staffToken);
    if (status !== 201) throw new Error(`Medical record creation failed: ${errorMsg}`);
    expect(data.data.id).toBeDefined();
    medicalRecordId = data.data.id;
  });

  test('should submit a claim for the patient with client-side ZKP generation', async () => {
    // 1. Persiapan Data (Get ZKP Preparation Data)
    const prepPayload = {
      patient_policy_id: patientPolicyId,
      medical_record_id: medicalRecordId,
      procedure_id: procedureIds[1],
      procedure_date: '2026-03-20',
      claim_amount: 1500000,
    };

    const prepRes = await apiRequest('/api/claims/prepare', 'GET', prepPayload, staffToken);
    if (prepRes.status !== 200) throw new Error(`ZKP preparation failed: ${prepRes.errorMsg}`);
    
    const prepData = prepRes.data.data;
    expect(prepData.diagnosisCode).toBeDefined();

    // 2. Simulasi Generate Proof di Sisi Client (di sini dijalankan oleh Node/Jest)
    // Import generateProof dinamis agar tidak bermasalah dengan environment
    const { generateProof } = await import('../service/zkp/proof');
    
    console.log('Generating integration proof (this may take a while)...');
    const { proof, publicSignals } = await generateProof(prepData);
    expect(proof).toBeDefined();

    // 3. Submisi Klaim Akhir (Post Claim with Proof)
    const claimPayload = {
      ...prepPayload,
      proof,
      public_signals: publicSignals
    };

    const { status, data, errorMsg } = await apiRequest('/api/claims', 'POST', claimPayload, staffToken);
    if (status !== 201) throw new Error(`Claim submission failed: ${errorMsg}`);
    expect(data.data.id).toBeDefined();
    claimId = data.data.id;
  });

  /**
   * Phase 4: Claim Approval (Insurance Reviewer)
   */
  test('should verify the claim presence and approve it', async () => {
    // 1. Verify claim is present and submitted
    const listRes = await apiRequest(`/api/claims?search=${claimId}`, 'GET', null, reviewerToken);
    expect(listRes.status).toBe(200);

    // 2. Approve the claim
    const approvePayload = {
      review_notes: 'Approved via comprehensive integration test',
    };

    const { status, data } = await apiRequest(`/api/claims/${claimId}/approve`, 'PATCH', approvePayload, reviewerToken);
    expect(status).toBe(200);
    expect(data.status).toBe('approved');
  });

  /**
   * Phase 5: Negative Scenarios (Failures & Security)
   * We wrap these in a describe to separate from the main happy path.
   * Logic: These tests run even if previousTestFailed is true, as long as dependencies (tokens) are available.
   */
  describe('Security & Logic Failures', () => {
    test('should reject login with invalid password', async () => {
      const { status } = await apiRequest('/api/auth/signin', 'POST', {
        email: reviewerCredentials.email,
        password: 'wrongpassword',
      });
      expect(status).toBe(401); 
    });

    test('should reject policy creation by a patient (Authorization)', async () => {
      const policyPayload = {
        policy_name: 'Illegal Policy',
        max_coverage_amount: 1000,
        valid_from: '2024-01-01',
        valid_until: '2027-12-31',
        diagnosis_codes: diagnosisCodes,
        procedure_codes: procedureIds,
      };
      const { status } = await apiRequest('/api/policies', 'POST', policyPayload, patientUserToken);
      expect(status).toBe(403);
    });

    test('should reject claim approval by a patient (Authorization)', async () => {
      const { status } = await apiRequest(`/api/claims/${claimId}/approve`, 'PATCH', { notes: 'Hack' }, patientUserToken);
      expect(status).toBe(403);
    });

    test('should reject claim with manipulated ZKP proof', async () => {
      // 1. Prepare data
      const prepPayload = {
        patient_policy_id: patientPolicyId,
        medical_record_id: medicalRecordId,
        procedure_id: procedureIds[0],
        procedure_date: '2026-03-25',
        claim_amount: 500000,
      };
      const prepRes = await apiRequest('/api/claims/prepare', 'GET', prepPayload, staffToken);
      const prepData = prepRes.data.data;

      // 2. Generate valid proof first
      const { generateProof } = await import('../service/zkp/proof');
      const { proof, publicSignals } = await generateProof(prepData);

      // 3. Manipulate proof (change one value in pi_a)
      const tamperedProof = JSON.parse(JSON.stringify(proof));
      tamperedProof.pi_a[0] = "1234567890"; // Invalid value

      // 4. Submit tampered proof
      const { status } = await apiRequest('/api/claims', 'POST', {
        ...prepPayload,
        proof: tamperedProof,
        public_signals: publicSignals
      }, staffToken);

      expect(status).toBe(400);
      console.log('✅ Successfully rejected tampered ZKP proof');
    });

    test('should reject claim mismatching public signals', async () => {
        // 1. Prepare data
        const prepPayload = {
          patient_policy_id: patientPolicyId,
          medical_record_id: medicalRecordId,
          procedure_id: procedureIds[0],
          procedure_date: '2026-03-25',
          claim_amount: 500000,
        };
        const prepRes = await apiRequest('/api/claims/prepare', 'GET', prepPayload, staffToken);
        const prepData = prepRes.data.data;
  
        // 2. Generate valid proof
        const { generateProof } = await import('../service/zkp/proof');
        const { proof, publicSignals } = await generateProof(prepData);
  
        // 3. Attempt to change claim_amount in body (e.g. to 1M) while proof is for 500k
        const { status } = await apiRequest('/api/claims', 'POST', {
          ...prepPayload,
          claim_amount: 1000000, // This mismatch should be caught
          proof,
          public_signals: publicSignals
        }, staffToken);
  
        expect(status).toBe(400);
        console.log('✅ Successfully rejected signal-body mismatch');
    });

    test('should reject claim for non-existent medical record', async () => {
      const { status } = await apiRequest('/api/claims', 'POST', {
        patient_policy_id: patientPolicyId,
        medical_record_id: '00000000-0000-0000-0000-000000000000',
        procedure_id: procedureIds[0],
        procedure_date: '2026-03-25',
        claim_amount: 1000,
        proof: {}, 
        public_signals: []
      }, staffToken);

      expect(status).toBe(404);
    });
  });

  // Clean up open handles after all tests
  afterAll(async () => {
    try {
      await redis.quit();
      console.log('✅ Redis connection closed for integration test');
    } catch (err) {
      console.log('⚠ Error closing Redis connection:', err);
    }
  });
});
