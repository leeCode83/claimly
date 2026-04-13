-- Migration: update_claims_rls_for_insurance_reviewer

-- Hapus policy yang lama terlebih dahulu
DROP POLICY IF EXISTS "claims_read" ON "public"."claims";

-- Buat ulang policy dengan kondisi tambahan untuk insurance_reviewer
CREATE POLICY "claims_read" ON "public"."claims" FOR SELECT TO "authenticated" 
USING (
  (
    ("public"."get_user_role"() = 'hospital_staff'::"text") AND (
      EXISTS (
        SELECT 1 FROM "public"."medical_records" "mr"
        WHERE ("mr"."id" = "claims"."medical_record_id") AND ("mr"."hospital_institution_id" = "public"."get_user_institution_id"())
      )
    )
  ) 
  OR 
  (
    -- Perubahan di sini: Hanya melihat klaim dengan status tertentu DAN dari institusi ('institution_id' yang memegang polis) yang sama
    ("public"."get_user_role"() = 'insurance_reviewer'::"text") AND 
    ("claims"."status" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'rejected'::"text"])) AND
    (
      EXISTS (
        SELECT 1 FROM "public"."patient_policies" "pp"
        JOIN "public"."insurance_policies" "ip" ON "pp"."policy_id" = "ip"."id"
        WHERE "pp"."id" = "claims"."patient_policy_id" AND "ip"."insurance_institution_id" = "public"."get_user_institution_id"()
      )
    )
  ) 
  OR 
  (
    ("public"."get_user_role"() = 'patient'::"text") AND (
      EXISTS (
        SELECT 1 FROM "public"."patient_policies" "pp"
        JOIN "public"."patients" "p" ON "p"."id" = "pp"."patient_id"
        WHERE "pp"."id" = "claims"."patient_policy_id" AND "p"."user_id" = "auth"."uid"()
      )
    )
  ) 
  OR 
  ("public"."get_user_role"() = 'admin'::"text")
);
