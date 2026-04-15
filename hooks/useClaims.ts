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
     * Helper to wait until claim status is at least 'submitted'.
     * Used to ensure proof is registered in DB before showing success UI.
     */
    const waitForStatusConfirmed = useCallback(async (claimId: string) => {
        // Simple polling for confirming 'submitted' status
        const maxRetries = 10;
        for (let i = 0; i < maxRetries; i++) {
            const { data, error } = await supabaseBrowser
                .from('claims')
                .select('status')
                .eq('id', claimId)
                .single();
            
            if (!error && data && (data.status === 'submitted' || data.status === 'approved' || data.status === 'rejected')) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return false;
    }, []);

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
        patient_policy_id?: string;
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
            if (params?.patient_policy_id) url.searchParams.append("patient_policy_id", params.patient_policy_id);

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
            console.log(result);

            if (!response.ok) {
                const message = result.error || `Gagal mengambil detail klaim ${id}`;
                toast.error("Error", { description: message });
                throw new Error(message);
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
     * @param payload Claim submission data including optional proof
     */
    const submitClaim = async (payload: {
        patient_policy_id: string;
        medical_record_id: string;
        procedure_id: string;
        procedure_date: string;
        claim_amount: number;
        proof?: any;
        public_signals?: string[];
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

            const isPending = !payload.proof;
            toast.success(isPending ? "Klaim Berhasil Disimpan" : "Klaim Berhasil Diajukan", {
                description: isPending 
                    ? "Status klaim saat ini PENDING. Silakan lampirkan proof nanti." 
                    : "ZKP proof telah disertakan dan status klaim telah menjadi submitted.",
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
                
                // If the error is 409 (Conflict/Needs Verification)
                if (response.status === 409) {
                    toast.warning("Verifikasi Diperlukan", { 
                        description: message + " Silakan tekan tombol 'Verifikasi' pada dashboard untuk memproses proof ini." 
                    });
                    return;
                }

                toast.error("Gagal Menyetujui Klaim", { description: message });
                throw new Error(message);
            }

            toast.success("Klaim Disetujui", {
                description: "Klaim telah berhasil disetujui.",
            });

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Internal helper to wait for ZKP verification results using Supabase Realtime.
     * Will resolve ONLY after status actually changes to approved/rejected.
     */
    const waitForVerificationResult = useCallback(async (claimId: string) => {
        setZkpStatus('verifying');

        const checkStatus = async () => {
            try {
                const { data: claim, error } = await supabaseBrowser
                    .from('claims')
                    .select('status, review_notes')
                    .eq('id', claimId)
                    .single();
                
                if (error) throw error;

                if (claim.status === 'approved' || claim.status === 'rejected') {
                    return { done: true, status: claim.status, notes: claim.review_notes };
                }
                return { done: false, status: null, notes: null };
            } catch (err) {
                console.error("Error checking verification status:", err);
                return { done: false, status: null, notes: null };
            }
        };

        const setFinalStatus = (status: string, notes?: string) => {
            if (status === 'approved') {
                setZkpStatus('success');
                toast.success("Verifikasi Berhasil", { 
                    description: "Klaim telah diverifikasi dan disetujui." 
                });
            } else {
                setZkpStatus('error');
                setZkpError(notes || "Verifikasi gagal.");
                toast.error("Verifikasi Gagal", { 
                    description: notes || "Bukti ZKP tidak valid atau tidak sesuai dengan kebijakan." 
                });
            }
        };

        return new Promise<void>((resolve, reject) => {
            // Initial check to handle fast workers or existing results
            checkStatus().then(async (result) => {
                if (result.done) {
                    setFinalStatus(result.status, result.notes || undefined);
                    resolve();
                    return;
                }

                // Subscribe to Realtime changes
                const channel = supabaseBrowser
                    .channel(`claim-verification-${claimId}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'claims',
                            filter: `id=eq.${claimId}`,
                        },
                        async (payload) => {
                            const newStatus = payload.new.status;
                            const notes = payload.new.review_notes;

                            if (newStatus === 'approved' || newStatus === 'rejected') {
                                setFinalStatus(newStatus, notes);
                                await supabaseBrowser.removeChannel(channel);
                                resolve();
                            }
                        }
                    )
                    .subscribe((status: string) => {
                        if (status !== 'SUBSCRIBED') {
                            // Fallback to polling if realtime fails
                            const interval = setInterval(async () => {
                                const result = await checkStatus();
                                if (result.done) {
                                    clearInterval(interval);
                                    setFinalStatus(result.status, result.notes || undefined);
                                    resolve();
                                }
                            }, 3000);
                        }
                    });

                // Safety timeout (30s) - after timeout, still resolve but indicate not done yet
                setTimeout(() => {
                    supabaseBrowser.removeChannel(channel);
                    // Check one more time before timeout
                    checkStatus().then((result) => {
                        if (result.done) {
                            setFinalStatus(result.status, result.notes || undefined);
                            resolve();
                        } else {
                            setZkpStatus(prev => (prev === 'verifying' ? 'error' : prev));
                            toast.info("Verifikasi Sedang Diproses", { 
                                description: "Mohon refresh halaman untuk melihat hasil verifikasi." 
                            });
                            resolve(); // Resolve anyway to unblock UI
                        }
                    });
                }, 30000);
            });
        });
    }, []);

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
            const submitResult = await submitClaim({
                ...payload,
                proof,
                public_signals: publicSignals
            });
            
            const claimId = submitResult.data.id;
            
            // Phase 4: Wait for Status Confirmation (ensure DB is updated to 'submitted')
            await waitForStatusConfirmed(claimId);
            
            setZkpStatus('success');
            return submitResult;
            
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

                if (response.status === 409) {
                    toast.warning("Verifikasi Diperlukan", { 
                        description: message + " Silakan lakukan verifikasi secara manual untuk memproses klaim ini." 
                    });
                    return;
                }

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

    /**
     * Generate and submit ZKP proof for an existing claim.
     * @param claimId Existing claim UUID
     * @param data Necessary claim data to generate the proof (from the claim object)
     */
    const submitProofForExistingClaim = async (claimId: string, data: {
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
                patient_policy_id: data.patient_policy_id,
                medical_record_id: data.medical_record_id,
                procedure_id: data.procedure_id,
                procedure_date: data.procedure_date,
                claim_amount: data.claim_amount.toString(),
            });
            
            const response = await fetch(`/api/claims/prepare?${prepParams.toString()}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || "Gagal menyiapkan data ZKP");
            }
            
            // Phase 2: Generate Proof
            setZkpStatus('generating');
            const { proof, publicSignals } = await generateProof(result.data);
            
            // Phase 3: Submit Proof
            setZkpStatus('submitting');
            const submitResponse = await fetch(`/api/claims/${claimId}/proof`, {
                method: "POST",
                headers: getHeaders(true),
                body: JSON.stringify({
                    proof,
                    public_signals: publicSignals
                }),
            });
            
            const submitResult = await submitResponse.json();
            
            if (!submitResponse.ok) {
                throw new Error(submitResult.error || "Gagal mengirimkan bukti ZKP");
            }

            // Using optional chaining and fallback to claimId to prevent crash if data structure varies
            const finalId = submitResult.data?.claim_id || submitResult.data?.id || claimId;
            
            // Phase 4: Wait for Status Confirmation
            await waitForStatusConfirmed(finalId);
            
            setZkpStatus('success');
            return submitResult;
        } catch (error: any) {
            console.error("[useClaims.submitProofForExistingClaim] Error:", error.message);
            setZkpStatus('error');
            setZkpError(error.message);
            toast.error("Gagal Memproses Bukti", { description: error.message });
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Re-trigger ZKP verification for a claim (for insurance_reviewer).
     * @param id Claim UUID
     */
    const verifyClaim = async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/claims/${id}/verify`, {
                method: "POST",
                headers: getHeaders(false),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal memicu verifikasi klaim.";
                toast.error("Gagal Verifikasi", { description: message });
                throw new Error(message);
            }

            toast.success("Verifikasi Dimulai", {
                description: result.message,
            });

            // Phase 2: Wait for result (New capability for the reviewer dashboard)
            await waitForVerificationResult(id);

            return result;
        } catch (error: any) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const resetZkpStatus = useCallback(() => {
        setZkpStatus('idle');
        setZkpError(null);
    }, []);

    return {
        isLoading,
        zkpStatus,
        zkpError,
        getClaims,
        getClaimById,
        submitClaim,
        submitClaimWithZkp,
        submitProofForExistingClaim,
        approveClaim,
        rejectClaim,
        verifyClaim,
        resetZkpStatus,
    };
};
