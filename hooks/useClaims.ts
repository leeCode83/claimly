"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle claims operations.
 * Provides functions to fetch, submit, approve, and reject claims.
 * Uses Sonner for notifications on mutation operations.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useClaims = (token?: string | null) => {
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
     * Fetch a paginated list of claims.
     * @param params Query parameters for pagination, sorting, status, and search.
     */
    const getClaims = useCallback(async (params?: {
        page?: number;
        limit?: number;
        sort_by?: string;
        sort_dir?: string;
        status?: string;
        search?: string;
    }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/claims", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());
            if (params?.sort_by) url.searchParams.append("sort_by", params.sort_by);
            if (params?.sort_dir) url.searchParams.append("sort_dir", params.sort_dir);
            if (params?.status) url.searchParams.append("status", params.status);
            if (params?.search) url.searchParams.append("search", params.search);

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar klaim");
            }

            return result;
        } catch (error: any) {
            console.error("[useClaims.getClaims] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a single claim by its ID.
     * @param id Claim UUID
     */
    const getClaimById = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/claims/${id}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil detail klaim ${id}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useClaims.getClaimById] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Submit a new claim.
     * @param payload Claim submission data
     */
    const submitClaim = async (payload: {
        patient_policy_id: string;
        medical_record_id: string;
        procedure_id: string;
        procedure_date: string;
        claim_amount: number;
    }) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/claims", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mengajukan klaim.";
                toast.error("Gagal Mengajukan Klaim", { description: message });
                throw new Error(message);
            }

            toast.success("Klaim Berhasil Diajukan", {
                description: "ZKP proof telah digenerate dan status klaim telah menjadi submitted.",
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Approve a pending claim (for insurance_reviewer).
     * @param id Claim UUID
     * @param reviewNotes Optional review notes
     */
    const approveClaim = async (id: string, reviewNotes?: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/claims/${id}/approve`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify({ review_notes: reviewNotes }),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menyetujui klaim.";
                toast.error("Gagal Menyetujui Klaim", { description: message });
                throw new Error(message);
            }

            toast.success("Klaim Disetujui", {
                description: "Klaim telah berhasil disetujui setelah verifikasi ZKP proof.",
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Reject a pending claim (for insurance_reviewer).
     * @param id Claim UUID
     * @param reviewNotes Review notes (required for rejection)
     */
    const rejectClaim = async (id: string, reviewNotes: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/claims/${id}/reject`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify({ review_notes: reviewNotes }),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menolak klaim.";
                toast.error("Gagal Menolak Klaim", { description: message });
                throw new Error(message);
            }

            toast.success("Klaim Ditolak", {
                description: "Klaim telah berhasil ditolak.",
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
        getClaims,
        getClaimById,
        submitClaim,
        approveClaim,
        rejectClaim,
    };
};
