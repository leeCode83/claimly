"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { decryptNoteInBrowser } from "@/lib/crypto/browser-crypto";

/**
 * Hook to handle medical record decryption for patients.
 * @param token Optional access_token for Authorization header.
 */
export const useDecryptNote = (token?: string | null) => {
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [decryptedNote, setDecryptedNote] = useState<string | null>(null);

    const clearNote = useCallback(() => {
        setDecryptedNote(null);
    }, []);

    /**
     * Decrypt a medical record using the user's password.
     * @param medicalRecordId UUID of the medical record
     * @param password User's plaintext password
     */
    const decryptNote = async (medicalRecordId: string, password: string) => {
        setIsDecrypting(true);
        try {
            const headers: Record<string, string> = {
                "Authorization": `Bearer ${token}`
            };

            // 1. Fetch Medical Record
            const mrResponse = await fetch(`/api/medical-records/${medicalRecordId}`, { headers });
            const mrResult = await mrResponse.json();
            if (!mrResponse.ok) throw new Error(mrResult.error || "Gagal mengambil data rekam medis");

            const medicalRecord = mrResult.data;
            if (!medicalRecord.notes_encrypted) {
                throw new Error("Rekam medis ini tidak memiliki catatan terenkripsi.");
            }

            // 2. Fetch My Private Key Info
            const userResponse = await fetch("/api/users/me", { headers });
            const userResult = await userResponse.json();
            if (!userResponse.ok) throw new Error(userResult.error || "Gagal mengambil profil user");

            const userData = userResult.data;
            if (!userData.encrypted_priv_key || !userData.key_derivation_salt || !userData.key_iv) {
                throw new Error("Akun Anda belum dikonfigurasi dengan enkripsi E2EE.");
            }

            // 3. Decrypt on Client Side
            const plaintext = await decryptNoteInBrowser(
                userData.encrypted_priv_key,
                userData.key_derivation_salt,
                userData.key_iv,
                password,
                medicalRecord.notes_encrypted
            );

            setDecryptedNote(plaintext);
            return plaintext;
        } catch (error: any) {
            console.error("[useDecryptNote] Error:", error.message);
            toast.error("Gagal Membuka Catatan", { 
                description: error.message === "Data provided to an operation does not meet requirements" 
                    ? "Password salah atau private key tidak valid." 
                    : error.message 
            });
            throw error;
        } finally {
            setIsDecrypting(false);
        }
    };

    return {
        isDecrypting,
        decryptedNote,
        decryptNote,
        clearNote
    };
};
