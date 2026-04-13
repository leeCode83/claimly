export interface AuditLogFilters {
    page?: number;
    limit?: number;
    action?: string;
    entity_type?: string;
    actor_id?: string;
    date_from?: string;
    date_to?: string;
}

export interface AuditLogActor {
    id: string;
    full_name: string;
    role: string;
}

export interface AuditLogEntry {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, any> | null;
    created_at: string;
    actor: AuditLogActor | null;
}

export interface AuditLogResponse {
    message: string;
    data: AuditLogEntry[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}
