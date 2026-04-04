import { verificationQueue } from "@/lib/queue";

export type VerificationSource = "submit" | "manual_review";

/**
 * Enqueue job verifikasi ZKP ke BullMQ.
 * Single source of truth untuk semua trigger verifikasi (submit otomatis vs manual reviewer).
 * 
 * @param claimId - ID klaim yang perlu diverifikasi
 * @param source - Asal permintaan verifikasi ("submit" atau "manual_review")
 */
export async function enqueueVerification(
    claimId: string,
    source: VerificationSource = "submit"
): Promise<void> {
    await verificationQueue.add("verify-zkp", { claimId, source });
    console.log(`[Queue] Enqueued ZKP verification: ${claimId} (source: ${source})`);
}
