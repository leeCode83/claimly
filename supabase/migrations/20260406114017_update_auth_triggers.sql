-- Update handle_new_user trigger to properly extract metadata from Keycloak's custom_claims
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;
