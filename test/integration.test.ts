import 'jest';

/**
 * Integration test for the main flow of the Claimly project.
 * This test simulates a real end-to-end scenario from user registration to claim approval.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Helper for API calls
async function apiRequest(endpoint: string, method: string = 'GET', body: any = null, token: string | null = null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await response.json();
  if (!response.ok) {
    return { status: response.status, data, errorMsg: data.error || data.message || JSON.stringify(data) };
  }
  return { status: response.status, data };
}

describe('Claimly Integration Flow', () => {
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
    const diagData = diagRes.data.data.slice(0, 5);
    diagnosisCodes = diagData.map((d: any) => d.icd10_code);
    diagnosisIds = diagData.map((d: any) => d.id);

    const procRes = await apiRequest('/api/policies/procedures', 'GET', null, reviewerToken);
    expect(procRes.status).toBe(200);
    expect(procRes.data.data.length).toBeGreaterThan(0);
    const procData = procRes.data.data.slice(0, 5);
    procedureCodes = procData.map((p: any) => p.icd9_code);
    procedureIds = procData.map((p: any) => p.id);
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

  test('should submit a claim for the patient', async () => {
    const claimPayload = {
      patient_policy_id: patientPolicyId,
      medical_record_id: medicalRecordId,
      procedure_id: procedureIds[1],
      procedure_date: '2026-03-20',
      claim_amount: 1500000,
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
});
