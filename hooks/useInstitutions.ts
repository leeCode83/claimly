"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle institution operations.
 * Provides functions to fetch, create, update, and delete institution data.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useInstitutions = (token?: string | null) => {
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
     * Fetch a paginated list of institutions.
     * @param params { page, limit }
     */
    const getInstitutions = useCallback(async (params?: { page?: number; limit?: number }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/institutions", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar institusi");
            }

            return result;
        } catch (error: any) {
            console.error("[useInstitutions.getInstitutions] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a single institution by its ID.
     * @param id Institution UUID
     */
    const getInstitution = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/institutions/${id}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil data institusi ${id}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useInstitutions.getInstitution] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Create a new institution.
     * @param payload Institution data
     */
    const createInstitution = async (payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/institutions", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menambahkan institusi.";
                toast.error("Gagal Menambah Institusi", { description: message });
                throw new Error(message);
            }

            toast.success("Institusi Berhasil Ditambahkan", {
                description: `Institusi ${payload.name || result.data?.name} telah tersimpan.`,
            });

            return result.data;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing institution.
     * @param id Institution UUID
     * @param payload Updated data
     */
    const updateInstitution = async (id: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/institutions/${id}`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal memperbarui data institusi.";
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Institusi Berhasil Diperbarui", {
                description: `Perubahan pada institusi telah berhasil disimpan.`,
            });

            return result.data;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Delete an institution.
     * @param id Institution UUID
     */
    const deleteInstitution = async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/institutions/${id}`, {
                method: "DELETE",
                headers: getHeaders(false),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menghapus institusi.";
                toast.error("Gagal Menghapus Institusi", { description: message });
                throw new Error(message);
            }

            toast.success("Institusi Dihapus", {
                description: "Institusi telah berhasil dihapus dari sistem.",
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
        getInstitutions,
        getInstitution,
        createInstitution,
        updateInstitution,
        deleteInstitution,
    };
};
