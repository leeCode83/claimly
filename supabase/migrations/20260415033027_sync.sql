drop policy "insurance_policies_delete" on "public"."insurance_policies";

drop policy "insurance_policies_insert" on "public"."insurance_policies";

drop policy "insurance_policies_update" on "public"."insurance_policies";


  create policy "insurance_policies_delete"
  on "public"."insurance_policies"
  as permissive
  for delete
  to authenticated
using ((public.get_user_role() = ANY (ARRAY['insurance_reviewer'::text, 'admin'::text])));



  create policy "insurance_policies_insert"
  on "public"."insurance_policies"
  as permissive
  for insert
  to authenticated
with check ((public.get_user_role() = ANY (ARRAY['insurance_reviewer'::text, 'admin'::text])));



  create policy "insurance_policies_update"
  on "public"."insurance_policies"
  as permissive
  for update
  to authenticated
using ((public.get_user_role() = ANY (ARRAY['insurance_reviewer'::text, 'admin'::text])))
with check ((public.get_user_role() = ANY (ARRAY['insurance_reviewer'::text, 'admin'::text])));



