# Claimly Load Testing Guide

## Overview

This directory contains load testing setup for the Claimly backend using [k6](https://k6.io/).

## Prerequisites

1. **Docker & Docker Compose** - For running the Claimly stack
2. **k6** - Load testing tool
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --batch --yes --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows
   winget install k6
   ```

3. **Supabase CLI** (optional, for direct database access)
   ```bash
   npm install -g supabase
   ```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Test Scenario                       │
├─────────────────────────────────────────────────────────────┤
│  100 Concurrent VUs                                         │
│  ├── Claims List (30%)      - GET /api/claims               │
│  ├── Claim Detail (20%)     - GET /api/claims/:id            │
│  ├── Patients List (15%)   - GET /api/patients              │
│  ├── Patient Detail (10%)  - GET /api/patients/:id           │
│  ├── Policies List (10%)   - GET /api/policies               │
│  ├── Medical Records (10%) - GET /api/medical-records        │
│  ├── Verify Claim (3%)     - POST /api/claims/:id/verify     │
│  └── Submit Claim (2%)     - POST /api/claims                │
├─────────────────────────────────────────────────────────────┤
│  Rate Limits (Upstash Redis)                                │
│  ├── listLimiter: 30 req/min (GETs)                         │
│  └── zkpLimiter: 10 req/min (POST verify)                    │
├─────────────────────────────────────────────────────────────┤
│  Caching (Redis)                                            │
│  ├── Claims: 5 min                                          │
│  ├── Patients: 15 min                                        │
│  ├── Policies: 1 hour                                        │
│  └── Medical Records: 10 min                                 │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the Docker Stack

```bash
# Start all services
docker-compose up -d

# Wait for services to be ready
docker-compose ps

# Check logs
docker-compose logs -f
```

### 2. Load Seed Data

```bash
# Method A: Using Docker exec
docker exec -i claimly-db psql -U postgres -d postgres < tests/load/seed-data.sql

# Method B: Using Supabase CLI (if configured)
psql $DATABASE_URL < tests/load/seed-data.sql

# Verify data loaded
docker exec -i claimly-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM claims;"
# Expected output: 200
```

### 3. Run Load Test

```bash
# Basic run (100 VUs for 5 minutes)
k6 run tests/load/k6-script.js

# With environment variables
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
API_BASE_URL=http://localhost:3000 \
k6 run tests/load/k6-script.js

# Run with custom duration
K6_DURATION=2m K6_VUS=50 k6 run tests/load/k6-script.js

# Export results to JSON
k6 run --out json=results.json tests/load/k6-script.js
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_BASE_URL` | Target API URL | `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key for auth | - |
| `ADMIN_ACCESS_TOKEN` | Pre-generated admin access token | - |

### k6 Options

The script supports two scenarios:

1. **Constant VUs** - 100 concurrent users for 5 minutes
2. **Ramping Load** - Gradual increase from 0 to 100 users

To select a specific scenario:

```bash
k6 run --env K6_SCENARIO=constant_vus tests/load/k6-script.js
```

## Test Endpoints

| Endpoint | Method | Weight | Rate Limit |
|----------|--------|--------|------------|
| `/api/claims` | GET | 30% | 30/min |
| `/api/claims/:id` | GET | 20% | 30/min |
| `/api/patients` | GET | 15% | 30/min |
| `/api/patients/:id` | GET | 10% | 30/min |
| `/api/policies` | GET | 10% | 30/min |
| `/api/medical-records` | GET | 10% | 30/min |
| `/api/claims/:id/verify` | POST | 3% | 10/min |
| `/api/claims` | POST | 2% | 10/min |

## Expected Results

With 100 concurrent VUs, you should see:

### Good Performance
- HTTP request duration p95 < 2000ms
- Error rate < 5%
- Request failure rate < 10%

### Metrics to Monitor

```bash
# Real-time metrics during test
k6 run tests/load/k6-script.js

# Watch Docker resource usage
docker stats

# Monitor Redis connections
docker exec claimly-redis redis-cli info clients
```

## Troubleshooting

### 1. Authentication Failures

If you see 401 errors:

```bash
# Verify service role key is correct
docker exec claimly-db psql -U postgres -d postgres -c \
  "SELECT key, created_at FROM auth.keys WHERE key_type = 'service_role_key';"

# Check environment variables are set
docker-compose exec api env | grep -E "(SUPABASE|KEYCLOAK)"
```

### 2. Rate Limit Errors

If you're hitting rate limits:

```bash
# Check rate limit configuration
docker exec claimly-api cat .env | grep UPSTASH

# Adjust limits in lib/rate-limit.ts if needed
```

### 3. Database Connection Issues

```bash
# Verify database is running
docker-compose ps db

# Check database logs
docker-compose logs db --tail=100

# Test connection
docker exec -i claimly-db psql -U postgres -d postgres -c "SELECT 1;"
```

### 4. Redis Connection Issues

```bash
# Verify Redis is running
docker-compose ps redis

# Test Redis connection
docker exec claimly-redis redis-cli ping
```

## Interpreting Results

### Success Metrics

```
========================================
  LOAD TEST SUMMARY
========================================

Test Duration: 5m 0s
Total VUs: 100

--- Request Metrics ---
HTTP Request Duration:
  avg: 150.23ms
  p95: 450.00ms
  max: 1200.00ms

Request Failure Rate: 2.50%

--- Custom Metrics ---
Claims GET Requests: 15000
Claims POST Requests: 500
Verify Requests: 300

--- Threshold Results ---
http_req_duration: PASS
http_req_failed: PASS
errors: PASS
========================================
```

### Warning Signs

- p95 > 2000ms: API is struggling under load
- Error rate > 5%: Something is broken
- Failure rate > 10%: Rate limiting or auth issues

## Advanced Usage

### Generate Test Token

For more realistic testing with individual user tokens:

```bash
# Create a test user token via Keycloak
curl -X POST "http://localhost:8080/realms/claimly/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=claimly-supabase" \
  -d "client_secret=your-client-secret" \
  -d "username=test-user@example.com" \
  -d "password=test-password"
```

### Run Specific Endpoints Only

Modify the `endpoints` array in `k6-script.js`:

```javascript
const endpoints = [
    { name: 'claims_list', weight: 70 },
    { name: 'claim_detail', weight: 30 },
];
```

### Distributed Load Testing

For distributed testing across multiple machines:

```bash
# On machine 1 (coordinator)
k6 run --out influxdb=http://localhost:8086/k6 tests/load/k6-script.js

# On machine 2-5 (workers)
k6-cloud run tests/load/k6-script.js
```

## Cleanup

```bash
# Stop containers
docker-compose down

# Remove test data (optional)
docker exec -i claimly-db psql -U postgres -d postgres -c \
  "TRUNCATE claims, patients, medical_records, audit_logs CASCADE;"

# Clean up k6 results
rm -f results.json summary.json
```

## See Also

- [k6 Documentation](https://k6.io/docs/)
- [Supabase Load Testing Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Upstash Rate Limiting](https://upstash.com/docs/ratelimit)
