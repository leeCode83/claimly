-- Migration: cleanup_insecure_rpc
-- Description: Menghapus fungsi RPC yang membypass RLS untuk beralih ke PostgREST yang lebih aman.

DROP FUNCTION IF EXISTS "public"."get_claims_paginated"(p_page integer, p_limit integer, p_sort_by text, p_sort_dir text, p_status text, p_search text);

-- Berikan komentar pada migrasi dihapus karena fungsi sudah di-drop
-- COMMENT ON FUNCTION "public"."get_claims_paginated" IS NULL;
