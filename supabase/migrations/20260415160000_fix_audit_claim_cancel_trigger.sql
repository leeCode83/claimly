-- ============================================================
-- Fix: Add SECURITY DEFINER to audit_claim_cancel trigger
-- Fixes RLS violation error when patient tries to cancel claim
-- ============================================================

-- Recreate trigger_audit_claim_cancel with SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger
DROP TRIGGER IF EXISTS trigger_audit_claim_cancel ON claims;
CREATE TRIGGER trigger_audit_claim_cancel
    AFTER UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_cancel();