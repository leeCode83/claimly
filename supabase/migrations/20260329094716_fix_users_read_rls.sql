drop policy if exists "users_read_colleagues" on "public"."users";
drop policy if exists "users_read_all" on "public"."users";

create policy "users_read_all"
  on "public"."users"
  as permissive
  for select
  to authenticated
using (true);




