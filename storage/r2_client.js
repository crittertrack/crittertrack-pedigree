// Minimal R2 client for the pedigree backend.
// This implementation POSTs the file buffer to an uploader endpoint (Cloudflare Worker)
// which is expected to accept multipart/form-data and return JSON { ok: true, url }.
//
// Environment variables:
// - UPLOADER_URL: full URL to the uploader endpoint (e.g. https://uploads.crittertrack.net/)
// - PUBLIC_HOST may be used as a fallback when UPLOADER_URL is not set.

const UPLOADER_URL = process.env.UPLOADER_URL || process.env.PUBLIC_HOST || null;

if (!UPLOADER_URL) {
  // Do not throw at module load time; exporting a function that will throw is clearer for runtime config.
}

async function uploadBuffer(key, buffer, contentType) {
  const target = (process.env.UPLOADER_URL || process.env.PUBLIC_HOST || '').replace(/\/$/, '');
  if (!target) throw new Error('UPLOADER_URL or PUBLIC_HOST must be set to upload to R2');

  // Use global FormData / Blob available in Node 18+ (engine set to 20.x).
  const form = new FormData();
  const blob = new Blob([buffer], { type: contentType || 'application/octet-stream' });
  form.append('file', blob, key);

  const resp = await fetch(target, { method: 'POST', body: form });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '<no body>');
    throw new Error(`Uploader responded with ${resp.status}: ${text}`);
  }
  const json = await resp.json().catch(() => null);
  if (json && json.url) return json.url;
  // Fall back to constructing the expected uploads URL
  return `${target}/uploads/${encodeURIComponent(key)}`;
}

module.exports = { uploadBuffer };
