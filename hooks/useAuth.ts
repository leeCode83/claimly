"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Hook to handle user authentication: SignIn and SignUp.
 * Uses Sonner for notifications and returns the access_token.
 */
export const useAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    /**
     * Authenticate a user with email and password.
     * @param payload { email, password }
     * @returns The access_token if successful
     */
    const signIn = async (payload: { email?: string; password?: string }) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/auth/signin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal masuk. Silakan cek kembali email dan password Anda.";
                toast.error("Sign In Gagal", {
                    description: message,
                });
                throw new Error(message);
            }

            const token = result.data.session?.access_token;
            setAccessToken(token);

            toast.success("Sign In Berhasil", {
                description: `Selamat datang kembali${result.data.user?.user_metadata?.full_name ? `, ${result.data.user.user_metadata.full_name}` : ""}!`,
            });

            return token;
        } catch (error: any) {
            // Error is handled in the if(!response.ok) block, but catching general network errors here
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
     * Register a new user.
     * @param payload { email, password, full_name, role, institution_id }
     * @returns The access_token if successful
     */
    const signUp = async (payload: {
        email?: string;
        password?: string;
        full_name?: string;
        role?: string;
        institution_id?: string;
    }) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal mendaftar. Silakan coba lagi.";
                toast.error("Sign Up Gagal", {
                    description: message,
                });
                throw new Error(message);
            }

            const token = result.data.session?.access_token;
            setAccessToken(token);

            toast.success("Sign Up Berhasil", {
                description: "Akun Anda telah berhasil dibuat. Silakan cek email untuk verifikasi.",
            });

            return token;
        } catch (error: any) {
            if (error.message === "Failed to fetch") {
                toast.error("Masalah Jaringan", {
                    description: "Tidak dapat terhubung ke server.",
                });
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Clear the stored access_token from state.
     */
    const logoutLocal = () => {
        setAccessToken(null);
    };

    return {
        signIn,
        signUp,
        logoutLocal,
        isLoading,
        accessToken,
    };
};
