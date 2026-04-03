-- 1. Create or replace function to sync metadata from public.users to auth.users
-- SECURITY DEFINER ensures this runs with postgres (admin) privileges to update auth schema
CREATE OR REPLACE FUNCTION public.sync_user_metadata_to_auth()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on public.users
DROP TRIGGER IF EXISTS on_user_profile_update ON public.users;
CREATE TRIGGER on_user_profile_update
AFTER UPDATE ON public.users
FOR EACH ROW
WHEN (
    OLD.role IS DISTINCT FROM NEW.role OR 
    OLD.institution_id IS DISTINCT FROM NEW.institution_id OR
    OLD.full_name IS DISTINCT FROM NEW.full_name
)
EXECUTE FUNCTION public.sync_user_metadata_to_auth();

-- 3. Backfill: sync existing data (including Lean An)
-- This update will fire the trigger for every user
UPDATE public.users
SET updated_at = NOW()
WHERE id IS NOT NULL;
