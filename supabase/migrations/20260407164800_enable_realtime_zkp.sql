-- 1. Pastikan tabel zkp_proofs memiliki REPLICA IDENTITY (agar data lengkap ikut di payload)
ALTER TABLE zkp_proofs REPLICA IDENTITY FULL;

-- 2. Tambahkan tabel ke dalam publikasi realtime (buat jika belum ada)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Menambahkan tabel zkp_proofs ke publikasi tersebut.
ALTER PUBLICATION supabase_realtime ADD TABLE zkp_proofs;
