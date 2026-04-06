import { NextRequest, NextResponse } from "next/server";
import { authLimiter, zkpLimiter, listLimiter, batchLimiter } from "@/lib/rate-limit";

/**
 * Helpler untuk mendapatkan alamat IP klien dari request headers.
 * Vercel dan proxy mengirimkan header x-forwarded-for yang lebih presisi.
 */
function getIp(request: NextRequest): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        "anonymous"
    );
}

/**
 * Middleware untuk mengontrol throughput API menggunakan Upstash Ratelimit.
 * Berjalan di Edge Runtime, efisien untuk mencegat request sebelum masuk ke route serverless.
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = getIp(request);
    const method = request.method;

    // Memetakan endpoint ke limiter yang sesuai (Tiering)
    let limiter = null;

    // --- TIER 1: Auth (Proteksi Brute Force) ---
    if (pathname.startsWith("/api/auth/signin") || pathname.startsWith("/api/auth/signup")) {
        limiter = authLimiter;
    }
    // --- TIER 2: ZKP & Claims Operations (Resource Intensive) ---
    else if (
        (pathname.match(/^\/api\/claims\/[^/]+\/verify$/) && method === "POST") ||
        (pathname === "/api/claims" && method === "POST") ||
        (pathname === "/api/claims/prepare" && method === "GET")
    ) {
        limiter = zkpLimiter;
    }
    // --- TIER 3: Batch Operations (Parsing & Bulk Writes) ---
    else if (
        pathname.startsWith("/api/policies/procedures/batch") ||
        pathname.startsWith("/api/policies/diagnoses/batch")
    ) {
        limiter = batchLimiter;
    }
    // --- TIER 4: List & Data Details (Anti-Scraping / Data Sensity) ---
    else if (
        (pathname === "/api/claims" && method === "GET") ||
        pathname.startsWith("/api/medical-records") ||
        pathname === "/api/users/me/crypto-data"
    ) {
        limiter = listLimiter;
    }

    // Jika tidak ada limiter yang terdaftar, lanjutkan akses normal
    if (!limiter) return NextResponse.next();

    // Jalankan pengecekan limit berdasarkan identifier (IP)
    const { success, limit, remaining, reset } = await limiter.limit(ip);

    if (!success) {
        return NextResponse.json(
            { error: "Too Many Requests. Silakan coba lagi nanti." },
            {
                status: 429,
                headers: {
                    "X-RateLimit-Limit": limit.toString(),
                    "X-RateLimit-Remaining": remaining.toString(),
                    "X-RateLimit-Reset": reset.toString(),
                    "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
                },
            }
        );
    }

    // Berikan metadata rate limit pada response headers agar informatif
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    
    return response;
}

/**
 * Konfigurasi matcher agar middleware hanya memproses API routes.
 * Mengabaikan file statis, next/_internal, dsb.
 */
export const config = {
    matcher: ["/api/:path*"],
};
