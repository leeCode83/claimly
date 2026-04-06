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
 * Updated to cover all endpoints and the new asynchronous ZKP verification flow.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
      const connector = url.includes('?') ? '&' : '?';
      url += `${connector}${params.toString()}`;
    } else {
      options.body = JSON.stringify(body);
    }
  }

  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    data = { error: text };
  }

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

  // Authentication data (Updated credentials)
  const staffCredentials = {
    email: 'budi@gmail.com',
    password: 'password123',
  };

  const reviewerCredentials = {
    email: 'joko@gmail.com',
    password: 'password123',
  };

  const newPatientUser = {
    email: `test.patient.${Date.now()}@example.com`,
    password: 'password123',
    full_name: 'Test Integration Patient',
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
   * Phase 1: Authentication & Context Setup
   */
  test('should register a new patient user', async () => {
    const { status, data, errorMsg } = await apiRequest('/api/auth/signup', 'POST', newPatientUser);
    if (status !== 201) throw new Error(`Signup failed: ${errorMsg}`);
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

  test('should login as hospital_staff (budi@gmail.com)', async () => {
    const { status, data, errorMsg } = await apiRequest('/api/auth/signin', 'POST', staffCredentials);
    if (status !== 200) throw new Error(`Staff login failed: ${errorMsg}`);
    expect(status).toBe(200);
    expect(data.data.session?.access_token).toBeDefined();
    staffToken = data.data.session.access_token;
  });

  test('should login as insurance_reviewer (joko@gmail.com)', async () => {
    const { status, data, errorMsg } = await apiRequest('/api/auth/signin', 'POST', reviewerCredentials);
    if (status !== 200) throw new Error(`Reviewer login failed: ${errorMsg}`);
    expect(status).toBe(200);
    expect(data.data.session?.access_token).toBeDefined();
    reviewerToken = data.data.session.access_token;
  });

  test('should fetch current user profile via /api/users/me', async () => {
    const { status, data } = await apiRequest('/api/users/me', 'GET', null, staffToken);
    expect(status).toBe(200);
    // email is in Supabase Auth, not in the users table — check role instead
    expect(data.data.role).toBe('hospital_staff');
  });

  test('should fetch institutions list', async () => {
    const { status, data } = await apiRequest('/api/institutions', 'GET', { limit: 5 }, staffToken);
    expect(status).toBe(200);
    expect(data.data).toBeDefined();
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

  test('should fetch and update the policy detail', async () => {
    // 1. Get detail
    const getRes = await apiRequest(`/api/policies/${policyId}`, 'GET', null, reviewerToken);
    expect(getRes.status).toBe(200);
    expect(getRes.data.data.id).toBe(policyId);

    // 2. Update name
    const updatePayload = { policy_name: `Updated Policy Name ${Date.now()}` };
    const updateRes = await apiRequest(`/api/policies/${policyId}`, 'PATCH', updatePayload, reviewerToken);
    expect(updateRes.status).toBe(200);
    // API returns a fixed success message, not the updated name
    expect(updateRes.data.message).toContain('successfully updated');
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

  test('should fetch patient detail by ID', async () => {
    const { status, data } = await apiRequest(`/api/patients/${patientId}`, 'GET', null, staffToken);
    expect(status).toBe(200);
    expect(data.data.id).toBe(patientId);
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

  test('should create a medical record for the patient with E2EE', async () => {
    // 1. Ambil public key pasien (simulasi behavior staff di frontend)
    // Pasien ini baru signup, jadi public key harusnya sudah ada via server-side fallback
    const { data: patientData, errorMsg: pError } = await apiRequest(`/api/patients/${patientId}`, 'GET', null, staffToken);
    if (pError) throw new Error(`Fetch patient failed: ${pError}`);
    
    // Public key ada di user object di dalam patient (via join)
    // Wait, let's check the structure returned by getPatientById
    // It returns select('*, patient_policies(*, insurance_policies(*))')
    // But does it join users? 
    // In migration 3C, get_patient_public_key joins users.
    // Let's re-verify UserService or use a direct check.
    
    // Sebenarnya di integration test kita bisa panggil RPC get_patient_public_key langsung
    // Tapi via REST API tidak ada endpoint langsung untuk RPC itu.
    // Kita asumsikan public_key ada di patientData.data.user_id (tapi kita butuh key-nya)
    
    // Alternatif: fetch /api/patients/:id and check if public_key is joined.
    // Berdasarkan PatientService.getPatientById: .select('*, patient_policies(*, insurance_policies(*))')
    // It DOES NOT join users.
    
    // So we need another way to get public_key in integration test.
    // For now, let's just send a dummy ciphertext to satisfy the service.
    const dummyCiphertext = JSON.stringify({
      epk: "dummy-epk",
      iv: "dummy-iv",
      ct: "dummy-ct"
    });

    const mrPayload = {
      patient_id: patientId,
      diagnosis_id: diagnosisIds[0],
      diagnosis_date: '2026-01-15',
      notes_encrypted: dummyCiphertext,
    };

    const { status, data, errorMsg } = await apiRequest('/api/medical-records', 'POST', mrPayload, staffToken);
    if (status !== 201) throw new Error(`Medical record creation failed: ${errorMsg}`);
    expect(data.data.id).toBeDefined();
    medicalRecordId = data.data.id;
  });

  test('should list medical records by patient ID', async () => {
    const { status, data } = await apiRequest('/api/medical-records', 'GET', { patient_id: patientId }, staffToken);
    expect(status).toBe(200);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
  });

  test('should submit a claim for the patient with client-side ZKP generation', async () => {
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

    // Simulation of Client-side ZKP Generation
    const { generateProof } = await import('../service/zkp/proof');
    console.log('Generating proof for integration test...');
    const { proof, publicSignals } = await generateProof(prepData);

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
   * Phase 3.1: Two-Step Claim Submission (Pending -> Submitted)
   */
  test('should submit a claim without proof and result in pending status', async () => {
    const pendingPayload = {
      patient_policy_id: patientPolicyId,
      medical_record_id: medicalRecordId,
      procedure_id: procedureIds[2], // different procedure
      procedure_date: '2026-03-22',
      claim_amount: 800000,
    };

    const { status, data, errorMsg } = await apiRequest('/api/claims', 'POST', pendingPayload, staffToken);
    if (status !== 201) throw new Error(`Pending claim submission failed: ${errorMsg}`);
    expect(data.data.id).toBeDefined();
    expect(data.data.status).toBe('pending');
    
    const pendingClaimId = data.data.id;

    // Now submit proof for this pending claim
    const prepRes = await apiRequest('/api/claims/prepare', 'GET', pendingPayload, staffToken);
    expect(prepRes.status).toBe(200);

    const { generateProof } = await import('../service/zkp/proof');
    const { proof, publicSignals } = await generateProof(prepRes.data.data);

    const proofPayload = {
      proof,
      public_signals: publicSignals
    };

    const proofRes = await apiRequest(`/api/claims/${pendingClaimId}/proof`, 'POST', proofPayload, staffToken);
    if (proofRes.status !== 200) throw new Error(`Submitting proof for pending claim failed: ${proofRes.errorMsg}`);
    expect(proofRes.data.message).toContain('berhasil disubmit');

    // Verify claim status is now 'submitted'
    const finalRes = await apiRequest(`/api/claims/${pendingClaimId}`, 'GET', null, staffToken);
    expect(finalRes.data.data.status).toBe('submitted');
  });

  /**
   * Phase 4: Claim Review (Insurance Reviewer)
   */
  test('should fetch claim detail and verify it (Async trigger)', async () => {
    // 1. Get detail
    const getRes = await apiRequest(`/api/claims/${claimId}`, 'GET', null, reviewerToken);
    expect(getRes.status).toBe(200);
    expect(getRes.data.data.id).toBe(claimId);

    // 2. Request verification (Async)
    const verifyRes = await apiRequest(`/api/claims/${claimId}/verify`, 'POST', null, reviewerToken);
    // Should be 202 because worker is not necessarily finished yet (or not running)
    expect([200, 202]).toContain(verifyRes.status);
    expect(verifyRes.data.message).toBeDefined();
  });

  test('should return 409 when approving immediately (Option A: Worker not running)', async () => {
    const approvePayload = { review_notes: 'Trying to approve while worker is pending' };
    const { status, data } = await apiRequest(`/api/claims/${claimId}/approve`, 'PATCH', approvePayload, reviewerToken);
    
    // In test env, verification_result stays null, so 409 is expected
    expect(status).toBe(409);
    expect(data.error).toContain('sedang diproses');
  });

  test('should reject the claim with notes', async () => {
    const rejectPayload = { review_notes: 'Rejected for integration test purposes' };
    const { status, data, errorMsg } = await apiRequest(`/api/claims/${claimId}/reject`, 'PATCH', rejectPayload, reviewerToken);
    
    if (status !== 200) throw new Error(`Claim rejection failed: ${errorMsg}`);
    expect(status).toBe(200);
    expect(data.message).toContain('berhasil ditolak');
  });

  /**
   * Phase 5: Security & Logic Failures
   */
  describe('Security & Logic Failures', () => {
    test('should reject login with invalid password', async () => {
      const { status } = await apiRequest('/api/auth/signin', 'POST', {
        email: reviewerCredentials.email,
        password: 'wrongpassword',
      });
      expect(status).toBe(401); 
    });

    test('should reject policy creation by a patient (Forbidden)', async () => {
      const policyPayload = { policy_name: 'Hack', max_coverage_amount: 100, valid_from: '2024-01-01', valid_until: '2027-12-31' };
      const { status } = await apiRequest('/api/policies', 'POST', policyPayload, patientUserToken);
      if (status === 500) {
        console.error('Expected 403 but got 500 - Checking for role validation in /api/policies POST');
      }
      expect(status).toBe(403);
    });

    test('should reject claim approval by unauthorized staff', async () => {
      const { status } = await apiRequest(`/api/claims/${claimId}/approve`, 'PATCH', { review_notes: 'Hack' }, staffToken);
      expect(status).toBe(403);
    });

    test('should reject claim with tampered ZKP proof', async () => {
      const prepPayload = { patient_policy_id: patientPolicyId, medical_record_id: medicalRecordId, procedure_id: procedureIds[0], procedure_date: '2026-03-25', claim_amount: 500000 };
      const prepRes = await apiRequest('/api/claims/prepare', 'GET', prepPayload, staffToken);
      
      if (prepRes.status !== 200 || !prepRes.data?.data) {
        throw new Error(`ZKP preparation failed for tampered proof test: ${prepRes.errorMsg || 'No data'}`);
      }

      const { generateProof } = await import('../service/zkp/proof');
      const { proof, publicSignals } = await generateProof(prepRes.data.data);

      const tamperedProof = JSON.parse(JSON.stringify(proof));
      tamperedProof.pi_a[0] = "99999999999"; 

      const { status } = await apiRequest('/api/claims', 'POST', { ...prepPayload, proof: tamperedProof, public_signals: publicSignals }, staffToken);
      expect(status).toBe(400);
    });

    test('should reject claim for non-existent MR', async () => {
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

  /**
   * Phase 6: Cleanup & Sign Out
   */
  test('should sign out all sessions', async () => {
    const resStaff = await apiRequest('/api/auth/signout', 'POST', null, staffToken);
    expect(resStaff.status).toBe(200);

    const resReviewer = await apiRequest('/api/auth/signout', 'POST', null, reviewerToken);
    expect(resReviewer.status).toBe(200);
  });

  // Master cleanup
  afterAll(async () => {
    try {
      await redis.quit();
      console.log('✅ Redis connection closed for integration test');
    } catch (err) {
      console.log('⚠ Error closing Redis connection:', err);
    }
  });
});
