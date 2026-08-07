/**
 * Magic-byte (file signature) validation.
 * Checks the first few bytes of a file buffer to verify the actual file type
 * matches the declared MIME type. Prevents disguised uploads.
 */

// Common magic byte signatures
const SIGNATURES: Record<string, number[]> = {
  // Images
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header; check WEBP at offset 8
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  // Video
  "video/mp4": [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp at offset 4
  "video/webm": [0x1A, 0x45, 0xDF, 0xA3],
  // Audio
  "audio/mpeg": [0xFF, 0xFB, 0xFF], // or 0x49 0x44 0x33 for ID3
  "audio/mp3": [0xFF, 0xFB, 0xFF],
  "audio/wav": [0x52, 0x49, 0x46, 0x46],
  "audio/x-wav": [0x52, 0x49, 0x46, 0x46],
  "audio/webm": [0x1A, 0x45, 0xDF, 0xA3],
};

// Alternative signatures (e.g., MP3 with ID3 header)
const ALT_SIGNATURES: Record<string, number[][]> = {
  "audio/mpeg": [[0xFF, 0xFB, 0xFF], [0x49, 0x44, 0x33]],
  "audio/mp3": [[0xFF, 0xFB, 0xFF], [0x49, 0x44, 0x33]],
};

/**
 * Validate that a file buffer's magic bytes match the declared MIME type.
 * Returns true if the signature matches, false otherwise.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const expected = SIGNATURES[mimeType];
  if (!expected) {
    // Unknown type — allow it (validation is opt-in for known types)
    return true;
  }

  // Check primary signature
  if (buffer.length < expected.length) return false;
  const matches = expected.every((byte, i) => buffer[i] === byte);
  if (matches) {
    // For WebP, also verify "WEBP" at offset 8
    if (mimeType === "image/webp") {
      return buffer.length >= 12 &&
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50;   // P
    }
    // For MP4, ftyp can start at offset 4
    if (mimeType === "video/mp4") {
      return buffer.length >= 12 &&
        buffer[4] === 0x66 && // f
        buffer[5] === 0x74 && // t
        buffer[6] === 0x79 && // y
        buffer[7] === 0x70;   // p
    }
    return true;
  }

  // Check alternative signatures
  const alts = ALT_SIGNATURES[mimeType];
  if (alts) {
    return alts.some((alt) => {
      if (buffer.length < alt.length) return false;
      return alt.every((byte, i) => buffer[i] === byte);
    });
  }

  return false;
}

/**
 * Detect the actual MIME type from magic bytes.
 * Returns the detected type or null if unknown.
 */
export function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signature] of Object.entries(SIGNATURES)) {
    if (buffer.length < signature.length) continue;
    if (signature.every((byte, i) => buffer[i] === byte)) {
      // Additional checks for WebP and MP4
      if (mimeType === "image/webp") {
        if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
          return mimeType;
        }
        continue;
      }
      if (mimeType === "video/mp4") {
        if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
          return mimeType;
        }
        continue;
      }
      // For WAV, check WAVE format at offset 8
      if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
        if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
          return mimeType;
        }
        continue;
      }
      return mimeType;
    }
  }
  return null;
}
