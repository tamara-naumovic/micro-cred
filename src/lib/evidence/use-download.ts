// Tiny client-side helper that turns a server-returned base64 file into a
// browser download (creates a Blob, clicks an anchor, revokes the URL).

export interface ServerFile {
  filename: string;
  contentType: string;
  base64: string;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function triggerDownload(file: ServerFile) {
  const blob = new Blob([base64ToBytes(file.base64)], { type: file.contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
