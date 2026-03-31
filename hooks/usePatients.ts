"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle patients operations.
 * Provides functions to fetch, register, and update patients data.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const usePatients = (token?: string | null) => {
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
     * Fetch a paginated list of patients (restricted to hospital's own patients for staff).
     * @param params { page, limit, search }
     */
    const getPatients = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/patients", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());
            if (params?.search) url.searchParams.append("search", params.search);

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar pasien");
            }

            return result;
        } catch (error: any) {
            console.error("[usePatients.getPatients] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a single patient by their ID.
     * @param id Patient UUID
     */
    const getPatient = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/patients/${id}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil data pasien ${id}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[usePatients.getPatient] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Register a new patient.
     * @param payload Patient registration data
     */
    const registerPatient = async (payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/patients", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mendaftarkan pasien.";
                toast.error("Registrasi Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Pasien Berhasil Didaftarkan", {
                description: `Data pasien ${payload.full_name || result.data?.full_name} telah tersimpan.`,
            });

            return result.data;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing patient's data.
     * @param id Patient UUID
     * @param payload Updated data
     */
    const updatePatient = async (id: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/patients/${id}`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mengupdate data pasien.";
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Data Pasien Diperbarui", {
                description: `Perubahan pada data pasien telah berhasil disimpan.`,
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
        getPatients,
        getPatient,
        registerPatient,
        updatePatient,
    };
};
