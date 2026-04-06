"use client";

import { useState } from "react";
import { toast } from "sonner";

import { generateUserKeypairInBrowser } from "@/lib/crypto/browser-crypto";

/**
 * Hook to handle user authentication: SignIn and SignUp.
 * Uses Sonner for notifications and returns the access_token.
 */
export const useAuth = (token?: string | null) => {
    const [isLoading, setIsLoading] = useState(false);
    const [localToken, setLocalToken] = useState<string | null>(null);
    const accessToken = token || localToken;

    /**
     * Authenticate a user with Keycloak OIDC.
     */
    const signIn = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/auth/signin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mendapatkan URL Login";
                toast.error("Otentikasi Gagal", {
                    description: message,
                });
                throw new Error(message);
            }

            if (result.data?.url) {
                // Redirect user to Keycloak login page
                window.location.href = result.data.url;
            }
        } catch (error: any) {
            if (error.message === "Failed to fetch") {
                toast.error("Masalah Jaringan", {
                    description: "Tidak dapat terhubung ke server. Silakan coba lagi nanti.",
                });
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Register a new user via Keycloak.
     */
    const signUp = async () => {
        // For OIDC, signup usually happens in the same IdP UI or a dedicated link.
        // We redirect to the same Keycloak login which usually has a 'Register' link.
        await signIn();
    };

    /**
     * Clear the stored access_token from state and destroy session on server.
     */
    const signOut = async () => {
        setIsLoading(true);
        try {
            await fetch("/api/auth/signout", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            
            // Clear local states
            setLocalToken(null);
            
            toast.success("Berhasil Keluar", {
                description: "Sesi Anda telah diakhiri."
            });
            
            // Hard redirect to the auth page (or logout endpoint will be handled by Context)
            window.location.href = "/auth";
        } catch (error) {
            console.error("[useAuth.signOut] Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Initialize ZKP cryptographic keys (Client-side generation).
     * Used for Zero-Knowledge privacy.
     */
    const initZkpKeys = async (pin: string) => {
        if (!accessToken) {
            toast.error("Error", { description: "Sesi pengguna tidak ditemukan" });
            return;
        }

        setIsLoading(true);
        try {
            toast.info("Menyiapkan kunci keamanan...", {
                description: "Generasi kunci enkripsi dilakukan secara lokal di perangkat Anda.",
            });
            
            const bundle = await generateUserKeypairInBrowser(pin);
            
            const response = await fetch("/api/auth/init-zkp", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    p_public_key: bundle.publicKeyB64,
                    p_encrypted_priv_key: bundle.encryptedPrivKeyB64,
                    p_key_derivation_salt: bundle.saltB64,
                    p_key_iv: bundle.ivB64,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                toast.error("Gagal Menyimpan Kunci", {
                    description: result.error || "Terjadi kesalahan saat sinkronisasi ZKP.",
                });
                throw new Error(result.error);
            }

            toast.success("Kunci Keamanan Berhasil Dibuat", {
                description: "Kunci kriptografi Anda kini telah siap digunakan.",
            });

            return result;
        } catch (error: any) {
            console.error("[AuthContext.initZkpKeys] Error:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        signIn,
        signUp,
        signOut,
        initZkpKeys,
        isLoading,
        accessToken,
    };
};
