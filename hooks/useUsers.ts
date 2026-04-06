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
     * @param isJson Boolean for Content-Type
     * @param overrideToken Optional token to override the hook's state token
     */
    const getHeaders = (isJson: boolean = true, overrideToken?: string | null) => {
        const headers: Record<string, string> = {};
        if (isJson) headers["Content-Type"] = "application/json";
        
        const authToken = overrideToken || token;
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        
        return headers;
    };

    /**
     * Fetch current user's profile information.
     * @param overrideToken Optional token to use instead of the one passed to the hook.
     */
    const getMe = useCallback(async (overrideToken?: string | null) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/users/me", {
                headers: getHeaders(false, overrideToken),
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

    /**
     * Fetch a paginated list of users (Admin only).
     * @param params { page, limit }
     */
    const getUsers = useCallback(async (params?: { page?: number; limit?: number }) => {
        setIsLoading(true);
        try {
            const url = new URL("/api/users", window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar user");
            }

            return result;
        } catch (error: any) {
            console.error("[useUsers.getUsers] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Delete a user (Admin only).
     * @param id User UUID
     */
    const deleteUser = async (id: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/users/${id}`, {
                method: "DELETE",
                headers: getHeaders(false),
            });

            const result = await response.json();

            if (!response.ok) {
                const message = result.error || "Gagal menghapus user.";
                toast.error("Gagal Menghapus", { description: message });
                throw new Error(message);
            }

            toast.success("User Dihapus", {
                description: "Data user telah berhasil dihapus dari sistem.",
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
        getUsers,
        getUserById,
        updateUser,
        deleteUser,
    };
};
