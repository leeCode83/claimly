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
            salt: salt.buffer, // Use .buffer
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    // 5. Encrypt (Wrap) the Private Key with AES-256-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivB64 = bufferToBase64(iv.buffer); // Use .buffer

    // AES-GCM in Web Crypto includes the auth tag at the end of the ciphertext by default
    const encryptedPrivKeyBuffer = await subtle.encrypt(
        { name: "AES-GCM", iv: iv.buffer }, // Use .buffer
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
