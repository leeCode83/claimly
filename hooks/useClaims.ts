"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { generateProof } from "@/service/zkp";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type ZkpStatus = 'idle' | 'preparing' | 'generating' | 'submitting' | 'verifying' | 'success' | 'error';

/**
 * Hook to handle claims operations.
 * Provides functions to fetch, submit, approve, and reject claims.
 * Uses Sonner for notifications on mutation operations.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useClaims = (token?: string | null) => {
    const [isLoading, setIsLoading] = useState(false);
    const [zkpStatus, setZkpStatus] = useState<ZkpStatus>('idle');
    const [zkpError, setZkpError] = useState<string | null>(null);

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
     * Orchestrates the ZKP claim submission: Prepare -> Generate Proof -> Submit.
     * @param payload Basic claim data
     */
    const submitClaimWithZkp = async (payload: {
        patient_policy_id: string;
        medical_record_id: string;
        procedure_id: string;
        procedure_date: string;
        claim_amount: number;
    }) => {
        setIsLoading(true);
        setZkpStatus('idle');
        setZkpError(null);
        
        try {
            // Phase 1: Prepare (Fetch Merkle paths & Signed URLs)
            setZkpStatus('preparing');
            const prepParams = new URLSearchParams({
                patient_policy_id: payload.patient_policy_id,
                medical_record_id: payload.medical_record_id,
                procedure_id: payload.procedure_id,
                procedure_date: payload.procedure_date,
                claim_amount: payload.claim_amount.toString(),
            });
            
            const prepResponse = await fetch(`/api/claims/prepare?${prepParams.toString()}`, {
                headers: getHeaders(false),
            });
            const prepResult = await prepResponse.json();
            
            if (!prepResponse.ok) {
                throw new Error(prepResult.error || "Gagal menyiapkan data ZKP");
            }
            
            const prepData = prepResult.data;
            
            // Phase 2: Generate Proof (Client-side heavy computation)
            setZkpStatus('generating');
            const { proof, publicSignals } = await generateProof(prepData);
            
            // Phase 3: Submit (Post claim + proof to server)
            setZkpStatus('submitting');
            const submitResponse = await fetch("/api/claims", {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify({
                    ...payload,
                    proof,
                    public_signals: publicSignals
                }),
            });
            
            const submitResult = await submitResponse.json();
            
            if (!submitResponse.ok) {
                throw new Error(submitResult.error || "Gagal mengirimkan klaim");
            }
            
            const claimId = submitResult.data.id;

            // Phase 4: Wait for Asynchronous Verification (Realtime)
            setZkpStatus('verifying');
            
            return new Promise((resolve, reject) => {
                // 1. "Check then Subscribe" - Cek apakah sudah selesai (race condition prevention)
                const checkStatus = async () => {
                    try {
                        const { data: claim, error } = await supabaseBrowser
                            .from('claims')
                            .select('status, review_notes')
                            .eq('id', claimId)
                            .single();
                        
                        if (error) throw error;

                        if (claim.status === 'approved' || claim.status === 'rejected') {
                            setFinalStatus(claim.status, claim.review_notes);
                            resolve(submitResult);
                            return true;
                        }
                        return false;
                    } catch (err) {
                        console.error("Error initial status check:", err);
                        return false;
                    }
                };

                const setFinalStatus = (status: string, notes?: string) => {
                    if (status === 'approved') {
                        setZkpStatus('success');
                        toast.success("Verifikasi Berhasil", { 
                            description: "Klaim Anda telah diverifikasi secara otomatis oleh sistem dan disetujui." 
                        });
                    } else {
                        setZkpStatus('error');
                        setZkpError(notes || "Verifikasi gagal.");
                        toast.error("Verifikasi Gagal", { 
                            description: notes || "Bukti ZKP tidak valid atau tidak sesuai dengan kebijakan." 
                        });
                    }
                };

                // Jalankan pengecekan pertama
                checkStatus().then(isDone => {
                    if (isDone) return;

                    // 2. Jika belum selesai, baru subscribe ke Realtime
                    const channel = supabaseBrowser
                        .channel(`claim-status-${claimId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'UPDATE',
                                schema: 'public',
                                table: 'claims',
                                filter: `id=eq.${claimId}`,
                            },
                            (payload) => {
                                const newStatus = payload.new.status;
                                const notes = payload.new.review_notes;

                                if (newStatus === 'approved' || newStatus === 'rejected') {
                                    setFinalStatus(newStatus, notes);
                                    supabaseBrowser.removeChannel(channel);
                                    resolve(submitResult);
                                }
                            }
                        )
                        .subscribe((status: string) => {
                            if (status !== 'SUBSCRIBED') {
                                // Fallback: Smart Polling jika Realtime gagal atau tidak bisa subscribe
                                console.warn("Realtime subscription failed, falling back to polling...");
                                const interval = setInterval(async () => {
                                    const done = await checkStatus();
                                    if (done) clearInterval(interval);
                                }, 3000);
                            }
                        });

                    // Timeout safety: Jika verifikasi > 60 detik
                    setTimeout(() => {
                        supabaseBrowser.removeChannel(channel);
                        if (zkpStatus === 'verifying') {
                            setZkpStatus('error');
                            setZkpError("Timeout: Verifikasi memakan waktu terlalu lama. Silakan cek daftar klaim nanti.");
                            reject(new Error("Verification timeout"));
                        }
                    }, 60000);
                });
            });
            
        } catch (error: any) {
            console.error("[useClaims.submitClaimWithZkp] Error:", error.message);
            setZkpStatus('error');
            setZkpError(error.message);
            toast.error("Gagal Memproses Klaim", { description: error.message });
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
        zkpStatus,
        zkpError,
        getClaims,
        getClaimById,
        submitClaim,
        submitClaimWithZkp,
        approveClaim,
        rejectClaim,
    };
};
