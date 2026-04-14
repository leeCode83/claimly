"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { encryptNoteInBrowser, decryptNoteInBrowser } from "@/lib/crypto/browser-crypto";

/**
 * Hook to handle medical records operations.
 * Provides functions to fetch, create, and update medical records.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useMedicalRecords = (token?: string | null) => {
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Helper to create request headers including the bearer token if available.
     */
    const getHeaders = (isJson: boolean = true) => {
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${token}`
        };
        if (isJson) headers["Content-Type"] = "application/json";
        return headers;
    };

    /**
     * Fetch a paginated list of medical records.
     * @param params { patient_id, page, limit }
     */
    const getMedicalRecords = useCallback(async (params?: { 
        patient_id?: string; 
        page?: number; 
        limit?: number;
        search?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/medical-records", window.location.origin);
            if (params?.patient_id) url.searchParams.append("patient_id", params.patient_id);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());
            if (params?.search) url.searchParams.append("search", params.search);
            if (params?.startDate) url.searchParams.append("startDate", params.startDate);
            if (params?.endDate) url.searchParams.append("endDate", params.endDate);

            const response = await fetch(url.toString(), {
                headers: {
                    ...getHeaders(false),
                },
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar rekam medis");
            }

            return result;
        } catch (error: any) {
            console.error("[useMedicalRecords.getMedicalRecords] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a single medical record by its ID.
     * @param id Medical Record UUID
     */
    const getMedicalRecord = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/medical-records/${id}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();
            console.log(result)

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil data rekam medis ${id}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useMedicalRecords.getMedicalRecord] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Create a new medical record (restricted to hospital_staff).
     * @param payload Medical record data 
     * @param patientPublicKey Patient's public key for encryption
     */
    const createMedicalRecord = async (payload: any, patientPublicKey?: string) => {
        setIsLoading(true);
        try {
            const { notes, ...rest } = payload;
            let notes_encrypted = null;

            if (notes && notes.trim() !== "") {
                if (!patientPublicKey) {
                    throw new Error("Public key pasien diperlukan untuk enkripsi catatan medis.");
                }
                notes_encrypted = await encryptNoteInBrowser(patientPublicKey, notes);
            }

            const response = await fetch("/api/medical-records", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify({
                    ...rest,
                    notes_encrypted
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menambahkan rekam medis.";
                toast.error("Gagal Menambah Rekam Medis", { description: message });
                throw new Error(message);
            }

            toast.success("Rekam Medis Berhasil Ditambahkan", {
                description: "Data rekam medis telah tersimpan secara aman dengan enkripsi E2EE.",
            });

            return result.data;
        } catch (error: any) {
            console.error("[useMedicalRecords.createMedicalRecord] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing medical record.
     * @param id Medical Record UUID
     * @param payload Updated data (typically notes)
     * @param patientPublicKey Patient's public key for encryption
     */
    const updateMedicalRecord = async (id: string, payload: any, patientPublicKey?: string) => {
        setIsLoading(true);
        try {
            const { notes, ...rest } = payload;
            let notes_encrypted = undefined;

            if (notes !== undefined) {
                if (notes && notes.trim() !== "") {
                    if (!patientPublicKey) {
                        throw new Error("Public key pasien diperlukan untuk enkripsi catatan medis.");
                    }
                    notes_encrypted = await encryptNoteInBrowser(patientPublicKey, notes);
                } else {
                    notes_encrypted = null;
                }
            }

            const response = await fetch(`/api/medical-records/${id}`, {
                method: "PUT",
                headers: getHeaders(true),
                body: JSON.stringify({
                    ...rest,
                    notes_encrypted
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mengupdate rekam medis.";
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Rekam Medis Diperbarui", {
                description: "Catatan rekam medis telah berhasil diperbarui dengan enkripsi baru.",
            });

            return result.data;
        } catch (error: any) {
            console.error("[useMedicalRecords.updateMedicalRecord] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Fully decrypt a medical record's note in the browser.
     * This handles both private key unwrapping and note decryption.
     * @param record The medical record object containing notes_encrypted
     * @param userData User object containing security keys (encrypted_priv_key, salt, iv)
     * @param password User's plaintext password for key derivation
     */
    const decryptMedicalRecord = async (record: any, userData: any, password: string) => {
        if (!password) {
            throw new Error("Password wajib diisi");
        }
        
        // Supports both prefixed (p_*) and non-prefixed property names from API
        const encryptedPrivKey = userData?.encrypted_priv_key || userData?.p_encrypted_priv_key;
        const salt = userData?.key_derivation_salt || userData?.p_key_derivation_salt;
        const iv = userData?.key_iv || userData?.p_key_iv;

        if (!encryptedPrivKey) {
            throw new Error("Kunci keamanan belum di-setup. Silakan cek tab Keamanan profil Anda.");
        }

        if (!record?.notes_encrypted) {
            throw new Error("Tidak ada catatan terenkripsi untuk rekam medis ini.");
        }

        setIsLoading(true);
        try {
            // decryptNoteInBrowser handles both PBKDF2 key derivation and ECIES decryption
            const plaintext = await decryptNoteInBrowser(
                encryptedPrivKey,
                salt,
                iv,
                password,
                record.notes_encrypted
            );
            return plaintext;
        } catch (error: any) {
            console.error("[useMedicalRecords.decryptMedicalRecord] Error:", error.message);
            // Specific message for cryptographic failure (usually wrong password)
            throw new Error("Gagal membuka catatan. Pastikan password keamanan Anda benar.");
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        getMedicalRecords,
        getMedicalRecord,
        createMedicalRecord,
        updateMedicalRecord,
        decryptMedicalRecord,
    };
};
