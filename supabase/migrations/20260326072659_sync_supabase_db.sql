create type "public"."roles" as enum ('hospital_staff', 'insurance_reviewer', 'patient', 'admin');

drop policy "diagnoses_write" on "public"."diagnoses";

alter table "public"."diagnoses" drop column "category";

alter table "public"."procedures" drop column "valid_diagnosis_encodings";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$BEGIN
    INSERT INTO public.users (id, full_name, role, institution_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
        'patient',
        (NEW.raw_user_meta_data->>'institution_id')::UUID
    );
    RETURN NEW;
END;$function$
;


  create policy "diagnoses_write"
  on "public"."diagnoses"
  as permissive
  for all
  to authenticated
using (true);


CREATE TRIGGER trigger_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


