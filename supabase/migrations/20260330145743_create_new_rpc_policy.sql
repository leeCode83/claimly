set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_policy_with_relations(p_insurance_institution_id uuid, p_policy_name text, p_max_coverage_amount numeric, p_valid_from timestamp with time zone, p_valid_until timestamp with time zone, p_approved_diagnosis_root text, p_approved_procedure_root text, p_is_active boolean, p_diagnoses jsonb, p_procedures jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_policy_id UUID;
BEGIN
    -- 1. Insert ke tabel utama (insurance_policies)
    INSERT INTO insurance_policies (
        insurance_institution_id,
        policy_name,
        max_coverage_amount,
        valid_from,
        valid_until,
        approved_diagnosis_root,
        approved_procedure_root,
        is_active
    ) VALUES (
        p_insurance_institution_id,
        p_policy_name,
        p_max_coverage_amount,
        p_valid_from,
        p_valid_until,
        p_approved_diagnosis_root,
        p_approved_procedure_root,
        p_is_active
    ) 
    RETURNING id INTO v_policy_id;

    -- 2. Insert array of objects ke policy_covered_diagnoses (jika ada)
    IF p_diagnoses IS NOT NULL AND jsonb_array_length(p_diagnoses) > 0 THEN
        INSERT INTO policy_covered_diagnoses (
            policy_id,
            diagnosis_id,
            merkle_leaf_index,
            merkle_leaf_hash
        )
        SELECT 
            v_policy_id,
            (elem->>'diagnosis_id')::UUID,
            (elem->>'merkle_leaf_index')::INTEGER,
            elem->>'merkle_leaf_hash'
        FROM jsonb_array_elements(p_diagnoses) AS elem;
    END IF;

    -- 3. Insert array of objects ke policy_covered_procedures (jika ada)
    IF p_procedures IS NOT NULL AND jsonb_array_length(p_procedures) > 0 THEN
        INSERT INTO policy_covered_procedures (
            policy_id,
            procedure_id,
            merkle_leaf_index,
            merkle_leaf_hash
        )
        SELECT 
            v_policy_id,
            (elem->>'procedure_id')::UUID,
            (elem->>'merkle_leaf_index')::INTEGER,
            elem->>'merkle_leaf_hash'
        FROM jsonb_array_elements(p_procedures) AS elem;
    END IF;

    -- Return ID yang baru saja dibuat
    RETURN v_policy_id;
END;
$function$
;


