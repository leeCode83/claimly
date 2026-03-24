-- ============================================================
-- RPC FUNCTIONS
-- ============================================================
 
-- Approve klaim dalam satu atomic transaction
CREATE OR REPLACE FUNCTION approve_claim(
    p_claim_id UUID,
    p_reviewer_id UUID,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE claims
    SET
        status = 'approved',
        reviewed_by = p_reviewer_id,
        review_notes = p_review_notes,
        reviewed_at = NOW()
    WHERE id = p_claim_id AND status = 'submitted';
 
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or not in submitted status';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
-- Reject klaim dalam satu atomic transaction
CREATE OR REPLACE FUNCTION reject_claim(
    p_claim_id UUID,
    p_reviewer_id UUID,
    p_review_notes TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE claims
    SET
        status = 'rejected',
        reviewed_by = p_reviewer_id,
        review_notes = p_review_notes,
        reviewed_at = NOW()
    WHERE id = p_claim_id AND status = 'submitted';
 
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or not in submitted status';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
-- Get claims dengan pagination, sort, dan search
CREATE OR REPLACE FUNCTION get_claims_paginated(
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 10,
    p_sort_by TEXT DEFAULT 'submitted_at',
    p_sort_dir TEXT DEFAULT 'desc',
    p_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    claim_id UUID,
    procedure_code TEXT,
    procedure_description TEXT,
    procedure_date DATE,
    claim_amount BIGINT,
    status TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    policy_commitment TEXT,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_limit;
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT
            c.id,
            pr.icd9_code,
            pr.description,
            c.procedure_date,
            c.claim_amount,
            c.status,
            c.submitted_at,
            c.reviewed_at,
            pp.policy_commitment,
            COUNT(*) OVER() AS total_count
        FROM claims c
        JOIN procedures pr ON pr.id = c.procedure_id
        JOIN patient_policies pp ON pp.id = c.patient_policy_id
        WHERE ($1::TEXT IS NULL OR c.status = $1)
        AND ($2::TEXT IS NULL OR pr.description ILIKE ''%%'' || $2 || ''%%'')
        ORDER BY %I %s
        LIMIT $3 OFFSET $4',
        p_sort_by,
        p_sort_dir
    )
    USING p_status, p_search, p_limit, v_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;