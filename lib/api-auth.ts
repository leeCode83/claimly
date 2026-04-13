import { NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';
import { UserProfile, AuthorizeOptions, AuthResult, Patient } from '@/types/auth';

const INSTITUTIONAL_ROLES = ['hospital_staff', 'insurance_reviewer'];

/**
 * Mengekstrak role dan institution_id dari metadata user Supabase (Keycloak custom claims).
 */
export function extractUserProfile(user: User): UserProfile {
    const role = (user.user_metadata?.custom_claims?.role || user.user_metadata?.role) || null;
    const institution_id = (user.user_metadata?.custom_claims?.institution_id || user.user_metadata?.institution_id) || null;
    return { role, institution_id };
}

/**
 * Melakukan otorisasi request API berdasarkan role dan validasi institusi.
 */
export function authorizeApiRequest(
    user: User,
    options: AuthorizeOptions
): AuthResult {
    const { role, institution_id } = extractUserProfile(user);

    // 1. Validasi Role
    if (!role || !options.allowedRoles.includes(role)) {
        return {
            role,
            institution_id,
            errorResponse: NextResponse.json(
                { error: `Forbidden: Anda tidak memiliki akses ke resource ini (membutuhkan ${options.allowedRoles.join(' atau ')})` },
                { status: 403 }
            )
        };
    }

    // 2. Validasi Institusi
    // Enforce institution_id untuk role institusional jika requireInstitution diaktifkan
    if (options.requireInstitution && role && INSTITUTIONAL_ROLES.includes(role) && !institution_id) {
        return {
            role,
            institution_id,
            errorResponse: NextResponse.json(
                { error: 'Forbidden: Akun Anda belum terhubung ke institusi manapun' },
                { status: 403 }
            )
        };
    }

    return { role, institution_id, errorResponse: null };
}

/**
 * Mengecek apakah requester memiliki akses ke resource pasien tertentu.
 */
export function checkPatientAccess(requesterUserId: string, requesterProfile: UserProfile, patient: Patient): string | null {
    if (requesterProfile.role === 'admin') {
        return null; // Admin memiliki hak akses penuh
    }

    if (requesterProfile.role === 'hospital_staff') {
        // hospital_staff hanya bisa akses pasien dari institusinya
        if (patient.hospital_id !== requesterProfile.institution_id) {
            return 'Forbidden: Anda hanya dapat mengakses pasien dari institusi Anda';
        }
        return null; // ok
    }

    if (requesterProfile.role === 'patient') {
        // Pasien yang mengakses datanya sendiri harus sudah memiliki akun (user_id tidak null)
        if (patient.user_id === null) {
            return 'Akses ditolak: Akun pasien ini belum terhubung ke user. Pasien perlu mendaftar akun terlebih dahulu.';
        }
        if (patient.user_id !== requesterUserId) {
            return 'Forbidden: Anda hanya dapat mengakses data pasien milik Anda sendiri';
        }
        return null; // ok
    }

    return 'Forbidden';
}
