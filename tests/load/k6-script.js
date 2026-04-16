import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const SERVICE_ROLE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const ADMIN_TOKEN = __ENV.ADMIN_ACCESS_TOKEN || '';

const errorRate = new Rate('errors');
const httpReqDuration = new Trend('http_req_duration');
const claimsGetDuration = new Trend('claims_get_duration');
const claimsPostDuration = new Trend('claims_post_duration');
const verifyDuration = new Trend('verify_duration');

const claimsGet = new Counter('claims_get_total');
const claimsPost = new Counter('claims_post_total');
const verifyPost = new Counter('verify_post_total');

const SLEEP_TIME = 0.1;

function getHeaders(isJson = true, authToken = '') {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    } else if (SERVICE_ROLE_KEY) {
        headers['x-service-key'] = SERVICE_ROLE_KEY;
    }
    return headers;
}

export const options = {
    scenarios: {
        constant_vus: {
            executor: 'constant-vus',
            vus: 100,
            duration: '5m',
            tags: { scenario: 'constant_100_vus' },
        },
        ramping_load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 50 },
                { duration: '1m', target: 100 },
                { duration: '3m', target: 100 },
                { duration: '30s', target: 0 },
            ],
            tags: { scenario: 'ramping_test' },
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.1'],
        errors: ['rate<0.05'],
        'claims_get_duration': ['p(95)<1500'],
        'claims_post_duration': ['p(95)<3000'],
        'verify_duration': ['p(95)<2000'],
    },
    discardResponseBodies: true,
};

export function setup() {
    let adminToken = ADMIN_TOKEN;

    if (!adminToken && SERVICE_ROLE_KEY) {
        const tokenResponse = http.post(
            `${BASE_URL}/api/auth/token`,
            JSON.stringify({
                grant_type: 'service_role',
                service_role_key: SERVICE_ROLE_KEY,
            }),
            { headers: getHeaders() }
        );

        if (tokenResponse.status === 200) {
            const data = JSON.parse(tokenResponse.body);
            adminToken = data.access_token;
        } else {
            console.log('Could not obtain admin token, using placeholder');
            adminToken = 'dummy-admin-token-for-load-test';
        }
    }

    const claimIdsResponse = http.get(
        `${BASE_URL}/api/claims?limit=100&status=submitted`,
        { headers: getHeaders(false, adminToken) }
    );

    let claimIds = [];
    if (claimIdsResponse.status === 200) {
        const data = JSON.parse(claimIdsResponse.body);
        claimIds = (data.data || []).map(c => c.id);
    }

    const policyIdsResponse = http.get(
        `${BASE_URL}/api/policies?limit=10`,
        { headers: getHeaders(false, adminToken) }
    );

    let policyIds = [];
    if (policyIdsResponse.status === 200) {
        const data = JSON.parse(policyIdsResponse.body);
        policyIds = (data.data || []).map(p => p.id);
    }

    const patientPolicyIdsResponse = http.get(
        `${BASE_URL}/api/patients?limit=50`,
        { headers: getHeaders(false, adminToken) }
    );

    let patientPolicyIds = [];
    if (patientPolicyIdsResponse.status === 200) {
        const data = JSON.parse(patientPolicyIdsResponse.body);
        patientPolicyIds = (data.data || [])
            .filter(p => p.patient_policies && p.patient_policies.length > 0)
            .flatMap(p => p.patient_policies.map(pp => pp.id));
    }

    return {
        adminToken,
        claimIds,
        policyIds,
        patientPolicyIds,
        userIds: [
            'c1111111-1111-1111-1111-111111111111',
            'c2222222-2222-2222-2222-222222222222',
            'c3333333-3333-3333-3333-333333333333',
            'c4444444-4444-4444-4444-444444444444',
            'c5555555-5555-5555-5555-555555555555',
            'c6666666-6666-6666-6666-666666666666',
            'c7777777-7777-7777-7777-777777777777',
            'c8888888-8888-8888-8888-888888888888',
            'c9999999-9999-9999-9999-999999999999',
            'ca000000-0000-0000-0000-000000000000',
        ],
    };
}

export default function(data) {
    const token = data.adminToken;
    const headers = getHeaders(false, token);

    const endpoints = [
        { name: 'claims_list', weight: 30 },
        { name: 'claim_detail', weight: 20 },
        { name: 'patients_list', weight: 15 },
        { name: 'patient_detail', weight: 10 },
        { name: 'policies_list', weight: 10 },
        { name: 'medical_records_list', weight: 10 },
        { name: 'verify_claim', weight: 3 },
        { name: 'submit_claim', weight: 2 },
    ];

    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulative = 0;
    let selectedEndpoint = endpoints[0];

    for (const endpoint of endpoints) {
        cumulative += endpoint.weight;
        if (random <= cumulative) {
            selectedEndpoint = endpoint;
            break;
        }
    }

    switch (selectedEndpoint.name) {
        case 'claims_list':
            testClaimsList(token);
            break;
        case 'claim_detail':
            testClaimDetail(token, data.claimIds);
            break;
        case 'patients_list':
            testPatientsList(token);
            break;
        case 'patient_detail':
            testPatientDetail(token);
            break;
        case 'policies_list':
            testPoliciesList(token);
            break;
        case 'medical_records_list':
            testMedicalRecordsList(token);
            break;
        case 'verify_claim':
            testVerifyClaim(token, data.claimIds);
            break;
        case 'submit_claim':
            testSubmitClaim(token, data.patientPolicyIds, data.userIds);
            break;
    }

    sleep(SLEEP_TIME);
}

function testClaimsList(token) {
    const params = [
        '?page=1&limit=10',
        '?page=1&limit=10&status=submitted',
        '?page=2&limit=10',
        '?page=1&limit=20&status=approved',
        '?page=1&limit=10&sort_by=submitted_at&sort_dir=desc',
    ];
    const param = params[Math.floor(Math.random() * params.length)];

    const res = http.get(`${BASE_URL}/api/claims${param}`, {
        headers: getHeaders(false, token),
        tags: { endpoint: 'claims_list' },
    });

    const duration = claimsGetDuration.add(res.timings.duration);
    claimsGet.add(1);

    check(res, {
        'claims_list status 200': (r) => r.status === 200,
        'claims_list has data': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.data && Array.isArray(body.data);
            } catch {
                return false;
            }
        },
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testClaimDetail(token, claimIds) {
    if (!claimIds || claimIds.length === 0) {
        return;
    }

    const claimId = claimIds[Math.floor(Math.random() * claimIds.length)];

    const res = http.get(`${BASE_URL}/api/claims/${claimId}`, {
        headers: getHeaders(false, token),
        tags: { endpoint: 'claim_detail' },
    });

    check(res, {
        'claim_detail status 200 or 404': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testPatientsList(token) {
    const params = [
        '?page=1&limit=10',
        '?page=1&limit=20',
        '?page=2&limit=10',
    ];
    const param = params[Math.floor(Math.random() * params.length)];

    const res = http.get(`${BASE_URL}/api/patients${param}`, {
        headers: getHeaders(false, token),
        tags: { endpoint: 'patients_list' },
    });

    check(res, {
        'patients_list status 200': (r) => r.status === 200,
        'patients_list has data': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.data && Array.isArray(body.data);
            } catch {
                return false;
            }
        },
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testPatientDetail(token) {
    const userIds = [
        'c1111111-1111-1111-1111-111111111111',
        'c2222222-2222-2222-2222-222222222222',
        'c3333333-3333-3333-3333-333333333333',
        'c4444444-4444-4444-4444-444444444444',
        'c5555555-5555-5555-5555-555555555555',
    ];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];

    const res = http.get(`${BASE_URL}/api/patients/${userId}`, {
        headers: getHeaders(false, token),
        tags: { endpoint: 'patient_detail' },
    });

    check(res, {
        'patient_detail status 200 or 404': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testPoliciesList(token) {
    const res = http.get(`${BASE_URL}/api/policies?page=1&limit=10`, {
        headers: getHeaders(false, token),
        tags: { endpoint: 'policies_list' },
    });

    check(res, {
        'policies_list status 200': (r) => r.status === 200,
        'policies_list has data': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.data && Array.isArray(body.data);
            } catch {
                return false;
            }
        },
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testMedicalRecordsList(token) {
    const params = [
        '?page=1&limit=10',
        '?page=1&limit=20',
        '?page=1&limit=10&patient_id=c1111111-1111-1111-1111-111111111111',
    ];
    const param = params[Math.floor(Math.random() * params.length)];

    const res = http.get(`${BASE_URL}/api/medical-records${param}`, {
        headers: getHeaders(false, token),
        tags: { endpoint: 'medical_records_list' },
    });

    check(res, {
        'medical_records_list status 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testVerifyClaim(token, claimIds) {
    if (!claimIds || claimIds.length === 0) {
        return;
    }

    const claimId = claimIds[Math.floor(Math.random() * claimIds.length)];

    const res = http.post(
        `${BASE_URL}/api/claims/${claimId}/verify`,
        JSON.stringify({}),
        {
            headers: getHeaders(false, token),
            tags: { endpoint: 'verify_claim' },
        }
    );

    const duration = verifyDuration.add(res.timings.duration);
    verifyPost.add(1);

    check(res, {
        'verify status 200 or 202': (r) => r.status === 200 || r.status === 202,
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

function testSubmitClaim(token, patientPolicyIds, userIds) {
    if (!patientPolicyIds || patientPolicyIds.length === 0) {
        return;
    }

    const patientPolicyId = patientPolicyIds[Math.floor(Math.random() * patientPolicyIds.length)];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];

    const claimData = {
        patient_policy_id: patientPolicyId,
        procedure_id: 'proc-uuid-placeholder',
        procedure_date: '2026-04-15',
        claim_amount: Math.floor(Math.random() * 5000000) + 100000,
        zkp_proof: {
            proof: {
                pi_a: [
                    '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345',
                    '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345',
                    '1'
                ],
                'pi_b': [
                    [
                        '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901',
                        '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901'
                    ],
                    [
                        '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901',
                        '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901'
                    ],
                    [
                        '1',
                        '0'
                    ]
                ],
                'pi_c': [
                    '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345',
                    '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345',
                    '1'
                ],
                protocol: 'groth16'
            },
            public_signals: [
                '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345',
                '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345'
            ]
        },
    };

    const res = http.post(
        `${BASE_URL}/api/claims`,
        JSON.stringify(claimData),
        {
            headers: getHeaders(false, token),
            tags: { endpoint: 'submit_claim' },
        }
    );

    const duration = claimsPostDuration.add(res.timings.duration);
    claimsPost.add(1);

    check(res, {
        'submit_claim status 201 or 400 or 500': (r) =>
            r.status === 201 || r.status === 400 || r.status === 500,
    }) || errorRate.add(1);

    httpReqDuration.add(res.timings.duration);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data, null, 2),
    };
}

function textSummary(data, opts) {
    const indent = opts.indent || '';
    const output = [];

    output.push('\n' + indent + '========================================');
    output.push(indent + '  LOAD TEST SUMMARY');
    output.push(indent + '========================================\n');

    const duration = data.state.testDurationMs / 1000;
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);

    output.push(indent + `Test Duration: ${mins}m ${secs}s`);
    output.push(indent + `Total VUs: ${data.metrics.vus?.value || 0}\n`);

    output.push(indent + '--- Request Metrics ---\n');

    const httpReqDuration = data.metrics.http_req_duration;
    if (httpReqDuration) {
        output.push(indent + `HTTP Request Duration:`);
        output.push(indent + `  avg: ${httpReqDuration.values.avg?.toFixed(2) || 0}ms`);
        output.push(indent + `  p95: ${httpReqDuration.values['p(95)']?.toFixed(2) || 0}ms`);
        output.push(indent + `  max: ${httpReqDuration.values.max?.toFixed(2) || 0}ms\n`);
    }

    const httpReqFailed = data.metrics.http_req_failed;
    if (httpReqFailed) {
        const failedPercent = (httpReqFailed.values.rate || 0) * 100;
        output.push(indent + `Request Failure Rate: ${failedPercent.toFixed(2)}%\n`);
    }

    output.push(indent + '--- Custom Metrics ---\n');

    const counters = [
        { name: 'claims_get_total', label: 'Claims GET Requests' },
        { name: 'claims_post_total', label: 'Claims POST Requests' },
        { name: 'verify_post_total', label: 'Verify Requests' },
    ];

    for (const counter of counters) {
        if (data.metrics[counter.name]) {
            output.push(indent + `${counter.label}: ${data.metrics[counter.name].values.count || 0}`);
        }
    }

    output.push('\n' + indent + '--- Threshold Results ---\n');

    const thresholds = data.metrics.thresholds || {};
    for (const [name, result] of Object.entries(thresholds)) {
        const passed = result.ok;
        const status = passed ? 'PASS' : 'FAIL';
        output.push(indent + `${name}: ${status}`);
    }

    output.push('\n' + indent + '========================================\n');

    return output.join('\n');
}
