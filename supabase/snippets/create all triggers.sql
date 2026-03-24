-- ============================================================
-- TRIGGERS
-- ============================================================
 
-- Auto update updated_at pada tabel users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
 
-- Auto insert audit log saat claim diinsert
CREATE OR REPLACE FUNCTION audit_claim_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        NEW.submitted_by,
        'CLAIM_SUBMITTED',
        'claims',
        NEW.id,
        jsonb_build_object(
            'claim_amount', NEW.claim_amount,
            'procedure_date', NEW.procedure_date,
            'status', NEW.status
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_audit_claim_insert
    AFTER INSERT ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_insert();
 
-- Auto insert audit log saat status claim berubah
CREATE OR REPLACE FUNCTION audit_claim_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            COALESCE(NEW.reviewed_by, NEW.submitted_by),
            'CLAIM_STATUS_CHANGED',
            'claims',
            NEW.id,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'review_notes', NEW.review_notes
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_audit_claim_status_change
    AFTER UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION audit_claim_status_change();
 
-- Auto update claim status ke 'submitted' saat proof berhasil diinsert
CREATE OR REPLACE FUNCTION update_claim_after_proof_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE claims
    SET status = 'submitted'
    WHERE id = NEW.claim_id AND status = 'proof_generating';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_update_claim_after_proof
    AFTER INSERT ON zkp_proofs
    FOR EACH ROW EXECUTE FUNCTION update_claim_after_proof_insert();
 
-- Auto insert audit log saat proof digenerate
CREATE OR REPLACE FUNCTION audit_proof_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_submitted_by UUID;
BEGIN
    SELECT submitted_by INTO v_submitted_by FROM claims WHERE id = NEW.claim_id;
 
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_submitted_by,
        'PROOF_GENERATED',
        'zkp_proofs',
        NEW.id,
        jsonb_build_object('claim_id', NEW.claim_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_audit_proof_insert
    AFTER INSERT ON zkp_proofs
    FOR EACH ROW EXECUTE FUNCTION audit_proof_insert();
 
-- Auto insert audit log saat proof diverifikasi
CREATE OR REPLACE FUNCTION audit_proof_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.verification_result IS NULL AND NEW.verification_result IS NOT NULL THEN
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            NULL,
            'PROOF_VERIFIED',
            'zkp_proofs',
            NEW.id,
            jsonb_build_object(
                'claim_id', NEW.claim_id,
                'verification_result', NEW.verification_result
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_audit_proof_verification
    AFTER UPDATE ON zkp_proofs
    FOR EACH ROW EXECUTE FUNCTION audit_proof_verification();