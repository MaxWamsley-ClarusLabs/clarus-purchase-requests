// Reading files chosen or dropped by the employee.

/** SHA-256 of the file content, hex encoded (the "file fingerprint", D-043). */
export async function fingerprintFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
