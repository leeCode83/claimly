import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

/**
 * Claimly k6 Load Testing Script
 * ---------------------------------------
 * This script tests the performance of the backend with 100 concurrent users.
 * Workflow:
 * 1. Hospital Staff logs in
 * 2. Register new patient
 * 3. Assign patient to a policy
 * 4. Create medical record (ICD-10)
 * 5. Submit insurance claim (triggers ZKP generation)
 * 6. Insurance Reviewer logs in
 * 7. Approve claim
 */

// Load CSV data for variety in test cases
const icd10CSV = new SharedArray('icd10_csv', function () {
  const file = open('../icd10.csv');
  return file.split('\n').slice(1).map(line => line.split(';')[0].trim()).filter(c => c);
});

const icd9CSV = new SharedArray('icd9_csv', function () {
  const file = open('C:/Users/Leandro/Downloads/icd9.csv');
  return file.split('\n').slice(1).map(line => line.split(',')[0].trim()).filter(c => c);
});

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Peak at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    // 95% of requests must complete below 20s (ZKP is computationally heavy under 100 VU load)
    http_req_duration: ['p(95)<20000'],
    http_req_failed: ['rate<0.10'], // Adjusted to 10% to account for intentional 500 errors (invalid submissions) and potential high load timeouts
  },
};

const BASE_URL = 'http://localhost:3000';

/**
 * Setup function runs once to fetch necessary master data IDs
 */
export function setup() {
  // Login as reviewer to create a universal policy
  const reviewerLoginRes = http.post(`${BASE_URL}/api/auth/signin`, JSON.stringify({
    email: 'budil@gmail.com',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  const reviewerToken = reviewerLoginRes.json('data.session.access_token');
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${reviewerToken}` 
  };

  // Fetch a sample of Diagnoses and Procedures 
  // We need n+1 diagnoses to have one uncovered diagnosis for the "failed submission" scenario
  const diagRes = http.get(`${BASE_URL}/api/policies/diagnoses?limit=21`, { headers });
  const procRes = http.get(`${BASE_URL}/api/policies/procedures?limit=20`, { headers });

  let diagData = diagRes.json('data') || [];
  const procData = procRes.json('data') || [];

  if (diagData.length < 2 || procData.length === 0) {
    console.error('Cannot run test without enough diagnoses/procedures in the database.');
    return { policies: [], diagnoses: [], procedures: [], uncoveredDiagnosis: null };
  }

  // Extract one diagnosis to act as the "uncovered" diagnosis
  const uncoveredDiagnosis = diagData.pop();

  // Create a universal policy for the load test covering the remaining diagnoses
  const policyRes = http.post(`${BASE_URL}/api/policies`, JSON.stringify({
    policy_name: `K6 Universal Policy ${Date.now()}`,
    max_coverage_amount: 1000000000, 
    valid_from: '2020-01-01',
    valid_until: '2030-01-01',
    diagnosis_codes: diagData.map(d => d.icd10_code),
    procedure_codes: procData.map(p => p.icd9_code)
  }), { headers });

  // Add 10s wait for setup because building two Merkle trees behind the scenes takes a few seconds
  check(policyRes, { 'universal policy created (ZKP Merkle Setup)': (r) => r.status === 201 });
  const policyId = policyRes.json('data.id') || policyRes.json('id'); // Account for different response formats

  return {
    policies: [policyId],
    diagnoses: diagData.map(d => d.id),
    procedures: procData.map(p => p.id),
    uncoveredDiagnosis: uncoveredDiagnosis.id
  };
}

export default function (data) {
  const { policies, diagnoses, procedures, uncoveredDiagnosis } = data;

  if (!policies.length || !diagnoses.length || !procedures.length) {
    console.error('Missing setup data. Ensure DB is seeded.');
    return;
  }

  // Determine scenario for this VU iteration
  // 0.0 - 0.8: Success Workflow (80%)
  // 0.8 - 0.9: Rejected Claim Workflow (10%)
  // 0.9 - 1.0: Failed Submission Workflow (10%)
  const scenarioRand = Math.random();
  let workflowType = 'success';
  if (scenarioRand >= 0.9) {
      workflowType = 'invalid_submission';
  } else if (scenarioRand >= 0.8) {
      workflowType = 'rejected';
  }

  // --- 1. HOSPITAL STAFF FLOW ---
  
  // Login
  const staffLoginRes = http.post(`${BASE_URL}/api/auth/signin`, JSON.stringify({
    email: 'ale.staff@rs-sehat.com',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  const staffToken = staffLoginRes.json('data.session.access_token');
  const staffHeaders = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${staffToken}` 
  };

  // Register Patient User Account
  const uniqueId = `${__VU}_${__ITER}_${Date.now()}`;
  const patientUserRes = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify({
    email: `p_${uniqueId}@loadtest.com`,
    password: 'password123',
    role: 'patient',
    full_name: `Patient LoadTest ${uniqueId}`
  }), { headers: { 'Content-Type': 'application/json' } });

  check(patientUserRes, { 'patient user registered': (r) => r.status === 201 });
  const newUserId = patientUserRes.json('data.user.id');

  // Register Patient Profile
  const patientRes = http.post(`${BASE_URL}/api/patients`, JSON.stringify({
    full_name: `Patient LoadTest ${uniqueId}`,
    birth_year: 1990,
    gender: 'M',
    nik: `123456${Math.floor(Math.random() * 1000000000)}`.substring(0, 16),
    user_id: newUserId || null // fallback just in case
  }), { headers: staffHeaders });

  check(patientRes, { 'patient registered': (r) => r.status === 201 });
  const patientId = patientRes.json('data.id');

  // Assign Policy
  // Since we use a universal policy, we just pick the first one
  const policyId = policies[0];
  const policyRes = http.post(`${BASE_URL}/api/patients/${patientId}/policies`, JSON.stringify({
    policy_id: policyId,
    policy_number: `POL-${uniqueId}`,
    start_date: '2026-01-01',
    end_date: '2027-01-01',
  }), { headers: staffHeaders });

  check(policyRes, { 'policy assigned': (r) => r.status === 201 });
  const patientPolicyId = policyRes.json('data.id');

  // Create Medical Record
  // If scenario is 'invalid_submission', use the uncovered diagnosis explicitly
  const diagId = workflowType === 'invalid_submission' 
        ? uncoveredDiagnosis 
        : diagnoses[Math.floor(Math.random() * diagnoses.length)];

  const mrRes = http.post(`${BASE_URL}/api/medical-records`, JSON.stringify({
    patient_id: patientId,
    diagnosis_id: diagId,
    diagnosis_date: '2026-03-20',
    notes: `Load testing diagnosis (${workflowType})`,
  }), { headers: staffHeaders });

  check(mrRes, { 'medical record created': (r) => r.status === 201 });
  const medicalRecordId = mrRes.json('data.id');

  // Submit Claim (Generates ZKP if valid)
  const procId = procedures[Math.floor(Math.random() * procedures.length)];
  const claimRes = http.post(`${BASE_URL}/api/claims`, JSON.stringify({
    patient_policy_id: patientPolicyId,
    medical_record_id: medicalRecordId,
    procedure_id: procId,
    procedure_date: '2026-03-25',
    claim_amount: 1500000,
  }), { headers: staffHeaders, timeout: '120s' }); // Long timeout for ZKP

  if (workflowType === 'invalid_submission') {
      // Expect the claim submission to gracefully fail (500 or 400 depending on exact handling)
      check(claimRes, { 'invalid claim correctly rejected at submission': (r) => r.status !== 201 });
      sleep(1);
      return; // End flow for this VU
  }

  // For success or rejected workflow, claim should have submitted successfully
  check(claimRes, { 'claim submitted': (r) => r.status === 201 });
  const claimId = claimRes.json('data.id');

  // If claim submission failed unexpectedly (e.g. timeout), end early to avoid breaking reviewer flow
  if (!claimId) {
      sleep(1);
      return; 
  }

  // --- 2. INSURANCE REVIEWER FLOW ---

  // Login
  const reviewerLoginRes = http.post(`${BASE_URL}/api/auth/signin`, JSON.stringify({
    email: 'budil@gmail.com',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });

  const reviewerToken = reviewerLoginRes.json('data.session.access_token');
  const reviewerHeaders = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${reviewerToken}` 
  };

  if (workflowType === 'success') {
      // Approve Claim
      const approveRes = http.patch(`${BASE_URL}/api/claims/${claimId}/approve`, JSON.stringify({
        review_notes: 'Automated approval from k6 load test',
      }), { headers: reviewerHeaders });

      check(approveRes, { 'claim approved': (r) => r.status === 200 });

  } else if (workflowType === 'rejected') {
      // Reject Claim
      const rejectRes = http.patch(`${BASE_URL}/api/claims/${claimId}/reject`, JSON.stringify({
        review_notes: 'Automated rejection from k6 load test (Business Logic Failure)',
      }), { headers: reviewerHeaders });

      check(rejectRes, { 'claim rejected': (r) => r.status === 200 });
  }

  sleep(1);
}
