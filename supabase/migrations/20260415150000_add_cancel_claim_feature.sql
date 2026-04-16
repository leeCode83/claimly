-- ============================================================
-- Cancel Claim Feature Migration
-- Patient can cancel their own claims when status is pending or submitted
-- ============================================================

-- A. Update status CHECK constraint - add 'canceled'
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE claims ADD CONSTRAINT claims_status_check CHECK (
    status IN ('pending', 'proof_generating', 'proof_failed', 'submitted', 'approved', 'rejected', 'canceled')
);

-- B. Add columns for cancel audit trail
ALTER TABLE claims
ADD COLUMN canceled_at TIMESTAMPTZ,
ADD COLUMN cancel_reason TEXT,
ADD COLUMN canceled_by UUID REFERENCES users(id);

-- C. Create audit trigger for cancel
CREATE OR REPLACE FUNCTION audit_claim_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('pending', 'submitted') AND NEW.status = 'canceled' THEN
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            NEW.canceled_by,
            'CLAIM_CANCELED',
            'claims',
            NEW.id,
            jsonb_build_object(
                'cancel_reason', NEW.cancel_reason,
                'previous_status', OLD.status,
                'claim_amount', OLD.claim_amount
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_claim_cancel ON claims;
CREATE TRIGGER trigger_audit_claim_cancel
    AFTER UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_cancel();

-- D. RLS Policy for patient cancel
-- Patient can only cancel their own claims with status pending or submitted
DROP POLICY IF EXISTS "claims_cancel_patient" ON claims;
CREATE POLICY "claims_cancel_patient" ON claims
    FOR UPDATE TO authenticated
    USING (
        get_user_role() = 'patient'
        AND status IN ('pending', 'submitted')
        AND EXISTS (
            SELECT 1 FROM patient_policies pp
            JOIN patients p ON p.id = pp.patient_id
            WHERE pp.id = claims.patient_policy_id
            AND p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        status = 'canceled'
        AND canceled_by = auth.uid()
        AND canceled_at IS NOT NULL
    );

-- E. Grant permissions
GRANT UPDATE ON claims TO authenticated;