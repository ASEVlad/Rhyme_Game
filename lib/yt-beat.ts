// hashUrl uses require('crypto') lazily so this file is safe to import in client components.
export function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?([^&]*&)*v=|youtu\.be\/[^&?\s]+)/.test(url.trim());
}

export function hashUrl(url: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto');
  return createHash('sha256').update(url.trim()).digest('hex').slice(0, 12);
}
