"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook to handle user-related operations.
 * Provides functions to fetch current user profile and update user data.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useUsers = (token?: string | null) => {
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
     * Fetch current user's profile information.
     */
    const getMe = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/users/me", {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil profil pengguna");
            }

            return result.data;
        } catch (error: any) {
            console.error("[useUsers.getMe] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch a user by their ID (admin only).
     * @param id User UUID
     */
    const getUserById = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/users/${id}`, {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil data user ${id}`);
            }

            return result.data;
        } catch (error: any) {
            console.error("[useUsers.getUserById] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Update user's profile information.
     * @param id User UUID
     * @param payload Updated user data
     */
    const updateUser = async (id: string, payload: any) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/users/${id}`, {
                method: "PATCH",
                headers: getHeaders(true),
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal memperbarui profil.";
                toast.error("Gagal Memperbarui Profil", { description: message });
                throw new Error(message);
            }

            toast.success("Profil Diperbarui", {
                description: "Data profil Anda telah berhasil disimpan.",
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
        getMe,
        getUserById,
        updateUser,
    };
};
