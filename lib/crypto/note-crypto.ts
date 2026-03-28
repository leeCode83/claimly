/**
 * lib/crypto/note-crypto.ts
 *
 * Server-side cryptographic utilities untuk enkripsi/dekripsi catatan dokter.
 * Menggunakan Node.js built-in `node:crypto` — tidak perlu package tambahan.
 *
 * Algoritma yang digunakan:
 *   - Key derivation : PBKDF2-SHA256 (untuk protect private key dengan password)
 *   - Keypair        : ECDH P-256 (untuk asymmetric encryption)
 *   - Data enkripsi  : AES-256-GCM (authenticated encryption)
 *
 * Format ciphertext yang disimpan di DB (JSON string):
 *   {
 *     "epk": "<base64 SPKI ephemeral public key>",  // kunci publik ephemeral dokter
 *     "iv":  "<base64 12 bytes>",                    // IV untuk AES-GCM
 *     "ct":  "<base64 ciphertext>",                  // data terenkripsi
 *     "tag": "<base64 16 bytes>"                     // auth tag AES-GCM
 *   }
 */

import {
    createCipheriv,
    createDecipheriv,
    pbkdf2Sync,
    randomBytes,
    createHash,
    generateKeyPairSync,
    createPublicKey,
    createPrivateKey,
    diffieHellman,
} from 'node:crypto';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Format JSON yang disimpan di kolom notes_encrypted */
export interface EncryptedNote {
    epk: string;   // ephemeral public key (base64 SPKI)
    iv:  string;   // AES-GCM IV (base64, 12 bytes)
    ct:  string;   // ciphertext (base64)
    tag: string;   // AES-GCM auth tag (base64, 16 bytes)
}

/** Output dari generateUserKeypairForServer */
export interface ServerKeypairBundle {
    publicKeyB64:       string;   // public key (base64 SPKI) → simpan plaintext di DB
    encryptedPrivKeyB64: string;  // private key terenkripsi AES-GCM (base64) → simpan di DB
    saltB64:            string;   // PBKDF2 salt (base64, 32 bytes) → simpan di DB
    ivB64:              string;   // AES-GCM IV untuk buka encryptedPrivKey (base64, 12 bytes) → simpan di DB
}

// ─────────────────────────────────────────────────────────────
// KEY DERIVATION
// ─────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEYLEN     = 32;        // 256 bits → cocok untuk AES-256
const PBKDF2_DIGEST     = 'sha256';

/**
 * Derive AES-256 key dari password dan salt menggunakan PBKDF2.
 * Ini menghasilkan masterKey yang digunakan untuk encrypt/decrypt private key.
 *
 * @param password  Password plaintext user (string)
 * @param saltB64   Salt dalam format base64 (32 bytes)
 * @returns         AES-256 key dalam bentuk Buffer (32 bytes)
 */
export function deriveMasterKey(password: string, saltB64: string): Buffer {
    const salt = Buffer.from(saltB64, 'base64');
    return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

// ─────────────────────────────────────────────────────────────
// KEYPAIR GENERATION (dipakai saat signup pasien)
// ─────────────────────────────────────────────────────────────

/**
 * Generate ECDH P-256 keypair untuk user baru, lalu wrap (enkripsi) private key
 * menggunakan password user. Hasilnya langsung siap disimpan ke DB.
 *
 * Dipanggil oleh AuthService.signUp() ketika role = "patient".
 *
 * @param password  Password plaintext user sebelum di-hash oleh Supabase Auth
 * @returns         ServerKeypairBundle — semua data siap disimpan ke tabel users
 */
export function generateUserKeypairForServer(password: string): ServerKeypairBundle {
    // 1. Generate ECDH P-256 keypair
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
    });

    // 2. Export public key format SPKI (standard untuk pertukaran kunci)
    const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    // 3. Export private key format PKCS8 (standard untuk penyimpanan private key)
    const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;

    // 4. Generate salt acak untuk PBKDF2
    const salt = randomBytes(32);
    const saltB64 = salt.toString('base64');

    // 5. Derive masterKey dari password + salt
    const masterKey = deriveMasterKey(password, saltB64);

    // 6. Enkripsi private key menggunakan AES-256-GCM dengan masterKey
    const iv = randomBytes(12);  // 96-bit IV untuk GCM (standar)
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    const encryptedPrivKey = Buffer.concat([cipher.update(privateKeyDer), cipher.final()]);
    const authTag = cipher.getAuthTag();  // 16-byte authentication tag

    // 7. Gabungkan ciphertext + authTag (kita perlu keduanya saat decrypt)
    const encryptedPrivKeyWithTag = Buffer.concat([encryptedPrivKey, authTag]);

    return {
        publicKeyB64,
        encryptedPrivKeyB64: encryptedPrivKeyWithTag.toString('base64'),
        saltB64,
        ivB64: iv.toString('base64'),
    };
}

// ─────────────────────────────────────────────────────────────
// NOTE ENCRYPTION (dipakai saat dokter tulis catatan)
// ─────────────────────────────────────────────────────────────

/**
 * Enkripsi catatan dokter menggunakan ECIES:
 *   1. Generate ephemeral ECDH keypair (satu kali pakai per note)
 *   2. Derive shared secret: ECDH(ephemeralPrivKey, patientPubKey)
 *   3. Derive AES key dari shared secret menggunakan HKDF-SHA256
 *   4. AES-256-GCM encrypt plaintext menggunakan AES key
 *   5. Simpan ephemeral public key + IV + ciphertext + auth tag
 *
 * Format output: JSON string → disimpan di notes_encrypted
 *
 * @param patientPublicKeyB64  ECDH P-256 public key pasien (base64 SPKI)
 * @param plaintext            Catatan dokter dalam teks biasa
 * @returns                    JSON string berisi data terenkripsi
 */
export function encryptNoteForPatient(patientPublicKeyB64: string, plaintext: string): string {
    // 1. Import public key pasien dari format SPKI
    const patientPublicKey = createPublicKey({
        key: Buffer.from(patientPublicKeyB64, 'base64'),
        format: 'der',
        type: 'spki',
    });

    // 2. Generate ephemeral ECDH keypair (satu kali pakai, tidak disimpan)
    const { privateKey: ephemeralPrivKey, publicKey: ephemeralPubKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
    });

    // 3. Derive shared secret menggunakan ECDH
    //    sharedSecret = ECDH(ephemeralPrivKey, patientPublicKey)
    //    Hanya pemegang patientPrivateKey yang bisa menghasilkan secret yang sama
    const sharedSecret = diffieHellman({
        privateKey: ephemeralPrivKey,
        publicKey: patientPublicKey,
    });

    // 4. Derive AES key dari shared secret menggunakan SHA-256 (simple KDF)
    //    Ini menghasilkan 32 bytes yang deterministik dari shared secret
    const aesKey = createHash('sha256').update(sharedSecret).digest();

    // 5. Enkripsi plaintext dengan AES-256-GCM
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // 6. Export ephemeral public key sebagai SPKI base64
    const epkB64 = ephemeralPubKey.export({ type: 'spki', format: 'der' }).toString('base64');

    // 7. Susun hasil sebagai JSON string
    const encryptedNote: EncryptedNote = {
        epk: epkB64,
        iv:  iv.toString('base64'),
        ct:  ciphertext.toString('base64'),
        tag: authTag.toString('base64'),
    };

    return JSON.stringify(encryptedNote);
}

// ─────────────────────────────────────────────────────────────
// NOTE DECRYPTION (opsional, dipakai jika server perlu baca ulang)
// ─────────────────────────────────────────────────────────────

/**
 * Dekripsi catatan yang sudah dienkripsi.
 * Dalam rencana ini, dekripsi TIDAK dilakukan server — ini hanya untuk testing/debug.
 * Dekripsi seharusnya dilakukan di browser pasien.
 *
 * @param patientPrivateKeyB64  ECDH P-256 private key pasien (base64 PKCS8)
 * @param encryptedNoteJson     JSON string dari encryptNoteForPatient()
 * @returns                     Plaintext catatan
 */
export function decryptNoteAsPatient(patientPrivateKeyB64: string, encryptedNoteJson: string): string {
    const { epk, iv, ct, tag } = JSON.parse(encryptedNoteJson) as EncryptedNote;

    // 1. Import private key pasien
    const patientPrivateKey = createPrivateKey({
        key: Buffer.from(patientPrivateKeyB64, 'base64'),
        format: 'der',
        type: 'pkcs8',
    });

    // 2. Import ephemeral public key (dari yang disimpan saat enkripsi)
    const ephemeralPublicKey = createPublicKey({
        key: Buffer.from(epk, 'base64'),
        format: 'der',
        type: 'spki',
    });

    // 3. Reproduce shared secret: ECDH(patientPrivKey, ephemeralPubKey)
    const sharedSecret = diffieHellman({
        privateKey: patientPrivateKey,
        publicKey: ephemeralPublicKey,
    });

    // 4. Derive AES key (sama seperti saat enkripsi)
    const aesKey = createHash('sha256').update(sharedSecret).digest();

    // 5. Dekripsi
    const decipher = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ct, 'base64')),
        decipher.final(),
    ]);

    return plaintext.toString('utf8');
}
