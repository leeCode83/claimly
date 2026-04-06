/**
 * lib/crypto/browser-crypto.ts
 *
 * Client-side cryptographic utilities using Web Crypto API.
 * This ensures private keys are generated and wrapped in the browser.
 */

export interface BrowserKeypairBundle {
    publicKeyB64: string;
    encryptedPrivKeyB64: string;
    saltB64: string;
    ivB64: string;
}

const PBKDF2_ITERATIONS = 310000;

/**
 * ArrayBuffer to Base64 helper
 */
function bufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * Base64 to ArrayBuffer helper
 */
function base64ToBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Generate ECDH P-256 keypair, derive master key from password, 
 * and wrap the private key.
 * 
 * @param password User's plaintext password
 */
export async function generateUserKeypairInBrowser(password: string): Promise<BrowserKeypairBundle> {
    const crypto = window.crypto;
    const subtle = crypto.subtle;

    // 1. Generate ECDH P-256 Keypair
    const keyPair = await subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true, // extractable
        ["deriveKey", "deriveBits"]
    );

    // 2. Export Public Key in SPKI format
    const publicKeyBuffer = await subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyB64 = bufferToBase64(publicKeyBuffer);

    // 3. Export Private Key in PKCS8 format
    const privateKeyBuffer = await subtle.exportKey("pkcs8", keyPair.privateKey);

    // 4. Prepare for Wrapping (PBKDF2)
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltB64 = bufferToBase64(salt.buffer);

    const encoder = new TextEncoder();
    const passwordKey = await subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const masterKey = await subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt.buffer, 
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"] // Added decrypt for unwrapping later
    );

    // 5. Encrypt (Wrap) the Private Key with AES-256-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivB64 = bufferToBase64(iv.buffer); 

    const encryptedPrivKeyBuffer = await subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer }, 
        masterKey,
        privateKeyBuffer
    );
    const encryptedPrivKeyB64 = bufferToBase64(encryptedPrivKeyBuffer);

    return {
        publicKeyB64,
        encryptedPrivKeyB64,
        saltB64,
        ivB64,
    };
}

/**
 * Encrypt medical notes using ECIES in the browser.
 * 
 * @param patientPublicKeyB64 Patient's public key (Base64 SPKI)
 * @param plaintext Notes to encrypt
 * @returns JSON string containing ephemeral public key, IV, and ciphertext
 */
export async function encryptNoteInBrowser(patientPublicKeyB64: string, plaintext: string): Promise<string> {
    const crypto = window.crypto;
    const subtle = crypto.subtle;

    // 1. Import patient's public key
    const patientPubKey = await subtle.importKey(
        "spki",
        base64ToBuffer(patientPublicKeyB64),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    // 2. Generate ephemeral keypair
    const ephemeralKeypair = await subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );

    // 3. Derive Shared Secret using ECDH
    const sharedSecret = await subtle.deriveBits(
        { name: "ECDH", public: patientPubKey },
        ephemeralKeypair.privateKey,
        256
    );

    // 4. Derive AES Key from shared secret (using simple SHA-256 hash as per server implementation)
    const aesKeyBuffer = await subtle.digest("SHA-256", sharedSecret);
    const aesKey = await subtle.importKey(
        "raw",
        aesKeyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    // 5. Encrypt with AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const ciphertextBuffer = await subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer },
        aesKey,
        encoder.encode(plaintext)
    );

    // 6. Export Ephemeral Public Key
    const epkBuffer = await subtle.exportKey("spki", ephemeralKeypair.publicKey);

    return JSON.stringify({
        epk: bufferToBase64(epkBuffer),
        iv: bufferToBase64(iv.buffer),
        // Web Crypto API includes the auth tag at the end of the encrypted buffer for AES-GCM
        ct: bufferToBase64(ciphertextBuffer),
    });
}

/**
 * Decrypt medical notes in the browser.
 */
export async function decryptNoteInBrowser(
    encryptedPrivKeyB64: string,
    saltB64: string,
    ivB64: string,
    password: string,
    encryptedNoteJson: string
): Promise<string> {
    const crypto = window.crypto;
    const subtle = crypto.subtle;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // 1. Derive Patient's Private Key from password
    const passwordKey = await subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const masterKey = await subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: base64ToBuffer(saltB64),
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const privateKeyPKCS8 = await subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBuffer(ivB64) },
        masterKey,
        base64ToBuffer(encryptedPrivKeyB64)
    );

    const patientPrivKey = await subtle.importKey(
        "pkcs8",
        privateKeyPKCS8,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );

    // 2. Parse encrypted note
    const { epk, iv, ct } = JSON.parse(encryptedNoteJson);

    // 3. Import Ephemeral Public Key
    const ephemeralPubKey = await subtle.importKey(
        "spki",
        base64ToBuffer(epk),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );

    // 4. Derive Shared Secret
    const sharedSecret = await subtle.deriveBits(
        { name: "ECDH", public: ephemeralPubKey },
        patientPrivKey,
        256
    );

    // 5. Derive AES Key
    const aesKeyBuffer = await subtle.digest("SHA-256", sharedSecret);
    const aesKey = await subtle.importKey(
        "raw",
        aesKeyBuffer,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    // 6. Decrypt ciphertext
    const plaintextBuffer = await subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBuffer(iv) },
        aesKey,
        base64ToBuffer(ct)
    );

    return decoder.decode(plaintextBuffer);
}
