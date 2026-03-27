alter table "public"."patients" add column "hospital_id" uuid;

alter table "public"."patients" add constraint "patients_hospital_id_fkey" FOREIGN KEY (hospital_id) REFERENCES public.institutions(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."patients" validate constraint "patients_hospital_id_fkey";


