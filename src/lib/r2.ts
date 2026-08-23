// A public R2 URL is typed by hand in Settings, and a custom domain is easy to
// enter bare ("files.example.com"). Concatenating that with a key produces a
// scheme-less URL, which a browser resolves against the app's own host — the
// image 404s in the library and in every email that embeds it. So the scheme is
// added here rather than trusted to have been typed.
export function normalizePublicUrl(publicUrl: string): string {
  const trimmed = publicUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Public URL for a stored object. */
export function publicAssetUrl(publicUrl: string, key: string): string {
  return `${normalizePublicUrl(publicUrl)}/${key.replace(/^\/+/, "")}`;
}
