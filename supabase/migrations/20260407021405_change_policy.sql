drop policy "zkp_proofs_read" on "public"."zkp_proofs";

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_role text;
    v_institution_id uuid;
    v_full_name text;
BEGIN
    -- Extract role from custom_claims -> role from Keycloak
    v_role := NEW.raw_user_meta_data->'custom_claims'->>'role';
    
    -- If role is completely empty or null, fallback safely to patient 
    -- rather than forcing everyone to be a patient
    IF v_role IS NULL OR BTRIM(v_role) = '' THEN
        v_role := 'patient';
    END IF;

    -- Extract institution_id from custom_claims -> institution_id
    -- Use a block to catch UUID casting errors in case Keycloak sends empty string
    BEGIN
        v_institution_id := NULLIF(BTRIM(NEW.raw_user_meta_data->'custom_claims'->>'institution_id'), '')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        v_institution_id := NULL;
    END;

    -- Extract full_name, looking at multiple possible keys
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->'custom_claims'->>'given_name',
        'Unknown'
    );

    INSERT INTO public.users (id, full_name, role, institution_id)
    VALUES (
        NEW.id,
        v_full_name,
        v_role,
        v_institution_id
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        institution_id = EXCLUDED.institution_id;
        
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_user_metadata_to_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'role', NEW.role,
            'institution_id', NEW.institution_id,
            'full_name', NEW.full_name
        )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$function$
;


  create policy "zkp_proofs_read"
  on "public"."zkp_proofs"
  as permissive
  for select
  to authenticated
using (true);



