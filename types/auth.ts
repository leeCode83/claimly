import { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export interface KeycloakCustomClaims {
  family_name?: string
  given_name?: string
  preferred_username?: string
  role?: string
  institution_id?: string
}

export interface KeycloakUserMetadata {
  custom_claims?: KeycloakCustomClaims
  email?: string
  email_verified?: boolean
  full_name?: string
  iss?: string
  name?: string
  phone_verified?: boolean
  provider_id?: string
  sub?: string
  // Legacy Supabase local user support
  role?: string
  institution_id?: string
  [key: string]: any
}

export interface AuthUser extends User {
  user_metadata: KeycloakUserMetadata
}

export interface UserProfile {
    role: string | null;
    institution_id: string | null;
}

export interface AuthorizeOptions {
    allowedRoles: string[];
    requireInstitution?: boolean;
}

export interface AuthResult extends UserProfile {
    errorResponse: NextResponse | null;
}

export interface Patient {
    hospital_id: string;
    user_id: string | null;
}
