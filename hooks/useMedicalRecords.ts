"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

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
        const headers: Record<string, string> = {};
        if (isJson) headers["Content-Type"] = "application/json";
        if (token) headers["Authorization"] = `Bearer ${token}`;
        return headers;
    };

    /**
     * Fetch a paginated list of medical records.
     * @param params { patient_id, page, limit }
     */
    const getMedicalRecords = useCallback(async (params?: { patient_id?: string; page?: number; limit?: number }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/medical-records", window.location.origin);
            if (params?.patient_id) url.searchParams.append("patient_id", params.patient_id);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
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
     * @param payload Medical record data (including patient_id, diagnosis_id, diagnosis_date, etc.)
     */
    const createMedicalRecord = async (payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/medical-records", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menambahkan rekam medis.";
                toast.error("Gagal Menambah Rekam Medis", { description: message });
                throw new Error(message);
            }

            toast.success("Rekam Medis Berhasil Ditambahkan", {
                description: "Data rekam medis telah tersimpan dan siap untuk diajukan klaim.",
            });

            return result.data;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing medical record.
     * @param id Medical Record UUID
     * @param payload Updated data (typically notes)
     */
    const updateMedicalRecord = async (id: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/medical-records/${id}`, {
                method: "PUT",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mengupdate rekam medis.";
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Rekam Medis Diperbarui", {
                description: "Catatan rekam medis telah berhasil diperbarui.",
            });

            return result.data;
        } catch (error: any) {
            throw error;
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
    };
};
