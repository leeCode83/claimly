alter table "public"."audit_logs" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."claims" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."diagnoses" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."institutions" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."insurance_policies" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."medical_records" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."patient_policies" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."patients" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."policy_covered_diagnoses" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."policy_covered_procedures" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."procedures" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."zkp_proofs" alter column "id" set default extensions.uuid_generate_v4();


