
  create policy "claims_update_hospital"
  on "public"."claims"
  as permissive
  for update
  to authenticated
using (((public.get_user_role() = 'hospital_staff'::text) AND (EXISTS ( SELECT 1
   FROM public.medical_records mr
  WHERE ((mr.id = claims.medical_record_id) AND (mr.hospital_institution_id = public.get_user_institution_id()))))));



  create policy "medical_records_update"
  on "public"."medical_records"
  as permissive
  for update
  to authenticated
using (((public.get_user_role() = 'hospital_staff'::text) AND (hospital_institution_id = public.get_user_institution_id())));



  create policy "patients_update_patient"
  on "public"."patients"
  as permissive
  for update
  to authenticated
using ((user_id = auth.uid()));



  create policy "zkp_proofs_insert"
  on "public"."zkp_proofs"
  as permissive
  for insert
  to authenticated
with check ((public.get_user_role() = 'hospital_staff'::text));



  create policy "zkp_proofs_update"
  on "public"."zkp_proofs"
  as permissive
  for update
  to authenticated
using ((public.get_user_role() = ANY (ARRAY['hospital_staff'::text, 'insurance_reviewer'::text, 'admin'::text])));



