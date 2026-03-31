"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle diagnoses operations.
 * Provides functions to fetch, create, update, delete, and batch upload diagnoses.
 * Uses Sonner for notifications on mutation operations.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useDiagnoses = (token?: string | null) => {
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Helper to create request headers including the bearer token if available.
     */
    const getHeaders = (isJson: boolean = true) => {
        const headers: Record<string, string> = {};
        if (isJson) headers["Content-Type"] = "application/json";
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return headers;
    };

    /**
     * Fetch a paginated list of diagnoses.
     * @param params { page, limit }
     */
    const getDiagnoses = useCallback(async (params?: { page?: number; limit?: number }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/policies/diagnoses", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar diagnosa");
            }

            return result;
        } catch (error: any) {
            console.error("[useDiagnoses.getDiagnoses] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Fetch a single diagnosis by its ICD code.
     * @param icd ICD-10 code
     */
    const getDiagnosis = useCallback(async (icd: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/diagnoses/${encodeURIComponent(icd)}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil diagnosa dengan kode ${icd}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useDiagnoses.getDiagnosis] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Create a new diagnosis entry.
     * @param payload Diagnosis data
     */
    const createDiagnosis = async (payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/policies/diagnoses", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menambahkan diagnosa.";
                toast.error("Gagal Menambah Diagnosa", { description: message });
                throw new Error(message);
            }

            toast.success("Diagnosa berhasil ditambahkan", {
                description: `Diagnosa ${payload.name || result.data?.name} telah tersimpan.`,
            });

            return result;
        } catch (error: any) {
            if (error.message === "Failed to fetch") {
                toast.error("Masalah Jaringan", { description: "Koneksi terputus saat mencoba menambah diagnosa." });
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing diagnosis by its ICD code.
     * @param icd ICD-10 code
     * @param payload Updated data
     */
    const updateDiagnosis = async (icd: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/diagnoses/${encodeURIComponent(icd)}`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || `Gagal memperbarui diagnosa ${icd}.`;
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Diagnosa Berhasil Diperbarui", {
                description: `Perubahan pada diagnosa dengan kode ${icd} telah disimpan.`,
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Delete a diagnosis by its ICD code.
     * @param icd ICD-10 code
     */
    const deleteDiagnosis = async (icd: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/diagnoses/${encodeURIComponent(icd)}`, {
                method: "DELETE",
                headers: getHeaders(false),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || `Gagal menghapus diagnosa ${icd}.`;
                toast.error("Hapus Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Diagnosa Dihapus", {
                description: `Diagnosa dengan kode ${icd} telah berhasil dihapus.`,
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Process a batch of diagnoses from a CSV file.
     * @param formData Should contain a 'file' field with the CSV file
     */
    const batchCreateDiagnoses = async (formData: FormData) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/policies/diagnoses/batch", {
                method: "POST",
                headers: getHeaders(false), // FormData handles its own Content-Type
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal memproses batch diagnosa.";
                toast.error("Batch Import Gagal", { 
                    description: result.invalid_count 
                        ? `${message} (${result.invalid_count} baris tidak valid)` 
                        : message 
                });
                throw new Error(message);
            }

            toast.success("Batch Import Berhasil", {
                description: result.message || `Berhasil memproses data diagnosa secara batch.`,
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        getDiagnoses,
        getDiagnosis,
        createDiagnosis,
        updateDiagnosis,
        deleteDiagnosis,
        batchCreateDiagnoses,
    };
};
