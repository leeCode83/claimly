"use client";

import { useState, useCallback } from "react";
import { AuditLogFilters, AuditLogResponse } from "@/types/audit";

/**
 * Hook to handle audit log operations.
 * Provides functions to fetch global audit logs and entity-specific logs.
 * @param token Optional access_token to be sent in the Authorization header.
 */
export const useAudit = (token?: string | null) => {
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Helper to create request headers including the bearer token if available.
     * @param isJson Boolean for Content-Type
     */
    const getHeaders = (isJson: boolean = true) => {
        const headers: Record<string, string> = {};
        if (isJson) headers["Content-Type"] = "application/json";
        
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        return headers;
    };

    /**
     * Fetch a paginated list of audit logs (Admin only).
     * @param filters AuditLogFilters
     */
    const getAuditLogs = useCallback(async (filters?: AuditLogFilters): Promise<AuditLogResponse> => {
        setIsLoading(true);
        try {
            const url = new URL("/api/audit-logs", window.location.origin);
            
            if (filters) {
                if (filters.page) url.searchParams.append("page", filters.page.toString());
                if (filters.limit) url.searchParams.append("limit", filters.limit.toString());
                if (filters.action && filters.action !== 'all') url.searchParams.append("action", filters.action);
                if (filters.entity_type && filters.entity_type !== 'all') url.searchParams.append("entity_type", filters.entity_type);
                if (filters.actor_id) url.searchParams.append("actor_id", filters.actor_id);
                if (filters.date_from) url.searchParams.append("date_from", filters.date_from);
                if (filters.date_to) url.searchParams.append("date_to", filters.date_to);
            }

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil daftar audit log");
            }

            return result;
        } catch (error: any) {
            console.error("[useAudit.getAuditLogs] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    /**
     * Fetch audit logs for a specific entity.
     * @param entityType Type of entity (e.g., 'claim', 'patient')
     * @param entityId ID of the entity
     * @param params { page, limit }
     */
    const getAuditLogsByEntity = useCallback(async (
        entityType: string, 
        entityId: string, 
        params?: { page?: number; limit?: number }
    ): Promise<AuditLogResponse> => {
        setIsLoading(true);
        try {
            const url = new URL(`/api/audit-logs/${entityType}/${entityId}`, window.location.origin);
            if (params?.page) url.searchParams.append("page", params.page.toString());
            if (params?.limit) url.searchParams.append("limit", params.limit.toString());

            const response = await fetch(url.toString(), {
                headers: getHeaders(false),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Gagal mengambil audit log untuk ${entityType} ${entityId}`);
            }

            return result;
        } catch (error: any) {
            console.error("[useAudit.getAuditLogsByEntity] Error:", error.message);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    return {
        isLoading,
        getAuditLogs,
        getAuditLogsByEntity,
    };
};
