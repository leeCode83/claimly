set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.audit_claim_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.audit_claim_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;


