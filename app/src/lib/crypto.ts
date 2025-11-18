// =============================================================================
// ENCRYPTION UTILITIES
// =============================================================================
// Provides AES-256-GCM encryption/decryption for sensitive data like OAuth tokens
//
// SECURITY NOTES:
// - Uses authenticated encryption (GCM mode) to prevent tampering
// - Generates a random IV (initialization vector) for each encryption
// - Requires ENCRYPTION_KEY environment variable (32-byte hex string)
// - In production, use a secrets management service (AWS Secrets Manager, Vault, etc.)

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment variables
 * Throws an error if not configured (fail-fast for security)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY not configured. Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, 'hex');
  
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters). Got ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a string using AES-256-GCM
 * 
 * @param plaintext - The text to encrypt
 * @returns Encrypted data in format: iv:authTag:ciphertext (all hex-encoded)
 * 
 * @example
 * const encrypted = encrypt('my-secret-token');
 * // Returns: "a1b2c3...d4e5f6:1a2b3c...4d5e6f:7a8b9c...0d1e2f"
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    
    // Generate random IV (unique per encryption)
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the plaintext
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    // Get authentication tag (prevents tampering)
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:ciphertext (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt a string that was encrypted with encrypt()
 * 
 * @param encryptedData - The encrypted data in format: iv:authTag:ciphertext
 * @returns The original plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 * 
 * @example
 * const decrypted = decrypt('a1b2c3...d4e5f6:1a2b3c...4d5e6f:7a8b9c...0d1e2f');
 * // Returns: "my-secret-token"
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    
    // Parse the encrypted data format
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected: iv:authTag:ciphertext');
    }
    
    const [ivHex, authTagHex, ciphertext] = parts;
    
    // Convert from hex to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
    }
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate a new random encryption key (for initial setup)
 * 
 * @returns A 32-byte hex string suitable for ENCRYPTION_KEY env var
 * 
 * @example
 * const key = generateEncryptionKey();
 * // Returns: "a1b2c3d4e5f6...012345" (64 hex characters)
 * // Add to .env: ENCRYPTION_KEY=<key>
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

// =============================================================================
// USAGE EXAMPLE (in API routes or services)
// =============================================================================
//
// // Encrypt before storing in database
// const encrypted = encrypt(accessToken);
// await prisma.figmaCredential.create({
//   data: { accessToken: encrypted, ... }
// });
//
// // Decrypt when reading from database
// const credential = await prisma.figmaCredential.findUnique(...);
// const decrypted = decrypt(credential.accessToken);
// // Use decrypted token for Figma API calls
//
// =============================================================================

