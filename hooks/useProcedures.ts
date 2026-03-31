"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle procedures operations.
 * Provides functions to fetch, create, update, delete, and batch upload procedures.
 * Uses Sonner for notifications on mutation operations.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useProcedures = (token?: string | null) => {
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
     * Fetch a paginated list of procedures.
     * @param params { page, limit }
     */
    const getProcedures = useCallback(async (params?: { page?: number; limit?: number }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/policies/procedures", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar prosedur");
            }

            return result;
        } catch (error: any) {
            console.error("[useProcedures.getProcedures] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a single procedure by its code (icd).
     * @param icd Procedure code
     */
    const getProcedure = useCallback(async (icd: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/procedures/${encodeURIComponent(icd)}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil prosedur dengan kode ${icd}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useProcedures.getProcedure] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Create a new procedure entry.
     * @param payload Procedure data
     */
    const createProcedure = async (payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/policies/procedures", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menambahkan prosedur.";
                toast.error("Gagal Menambah Prosedur", { description: message });
                throw new Error(message);
            }

            toast.success("Prosedur berhasil ditambahkan", {
                description: `Prosedur ${payload.name || result.data?.name} telah tersimpan.`,
            });

            return result;
        } catch (error: any) {
            if (error.message === "Failed to fetch") {
                toast.error("Masalah Jaringan", { description: "Koneksi terputus saat mencoba menambah prosedur." });
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing procedure by its code (icd).
     * @param icd Procedure code
     * @param payload Updated data
     */
    const updateProcedure = async (icd: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/procedures/${encodeURIComponent(icd)}`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || `Gagal memperbarui prosedur ${icd}.`;
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Prosedur Berhasil Diperbarui", {
                description: `Perubahan pada prosedur dengan kode ${icd} telah disimpan.`,
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Delete a procedure by its code (icd).
     * @param icd Procedure code
     */
    const deleteProcedure = async (icd: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/procedures/${encodeURIComponent(icd)}`, {
                method: "DELETE",
                headers: getHeaders(false),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || `Gagal menghapus prosedur ${icd}.`;
                toast.error("Hapus Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Prosedur Dihapus", {
                description: `Prosedur dengan kode ${icd} telah berhasil dihapus.`,
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Process a batch of procedures from a CSV file.
     * @param formData Should contain a 'file' field with the CSV file
     */
    const batchCreateProcedures = async (formData: FormData) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/policies/procedures/batch", {
                method: "POST",
                headers: getHeaders(false),
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal memproses batch prosedur.";
                toast.error("Batch Import Gagal", { 
                    description: result.invalid_count 
                        ? `${message} (${result.invalid_count} baris tidak valid)` 
                        : message 
                });
                throw new Error(message);
            }

            toast.success("Batch Import Berhasil", {
                description: result.message || `Berhasil memproses data prosedur secara batch.`,
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
        getProcedures,
        getProcedure,
        createProcedure,
        updateProcedure,
        deleteProcedure,
        batchCreateProcedures,
    };
};
