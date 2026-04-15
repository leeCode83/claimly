"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle insurance policies operations.
 * Provides functions to fetch, create, update, and delete policies.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useInsurancePolicies = (token?: string | null) => {
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
     * Fetch a paginated list of policies.
     * @param params { page, limit, institutionId, isActive }
     */
    const getPolicies = useCallback(async (params?: { page?: number; limit?: number; institutionId?: string; isActive?: boolean }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/policies", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());
            if (params?.institutionId) url.searchParams.append("institution_id", params.institutionId);
            if (params?.isActive !== undefined && params?.isActive !== null) {
                url.searchParams.append("is_active", params.isActive.toString());
            }

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar polis");
            }

            return result;
        } catch (error: any) {
            console.error("[useInsurancePolicies.getPolicies] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a single policy by its ID.
     * @param id Policy UUID
     */
    const getPolicy = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/${id}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil data polis ${id}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useInsurancePolicies.getPolicy] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Create a new insurance policy.
     * @param payload Policy data
     */
    const createPolicy = async (payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/policies", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menambahkan polis.";
                toast.error("Gagal Menambah Polis", { description: message });
                throw new Error(message);
            }

            toast.success("Polis Berhasil Ditambahkan", {
                description: `Polis ${payload.name || result.data?.name} telah tersimpan.`,
            });

            return result.data;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Update an existing insurance policy.
     * @param id Policy UUID
     * @param payload Updated data
     */
    const updatePolicy = async (id: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/${id}`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal memperbarui data polis.";
                toast.error("Update Gagal", { description: message });
                throw new Error(message);
            }

            toast.success("Polis Berhasil Diperbarui", {
                description: `Perubahan pada polis telah berhasil disimpan.`,
            });

            return result.data;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Delete a policy.
     * @param id Policy UUID
     */
    const deletePolicy = async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/policies/${id}`, {
                method: "DELETE",
                headers: getHeaders(false),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menghapus polis.";
                toast.error("Gagal Menghapus Polis", { description: message });
                throw new Error(message);
            }

            toast.success("Polis Dihapus", {
                description: "Polis telah berhasil dihapus dari sistem.",
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
        getPolicies,
        getPolicy,
        createPolicy,
        updatePolicy,
        deletePolicy,
    };
};
