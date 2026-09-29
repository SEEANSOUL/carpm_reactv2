/** Shot media: video mi yoksa statik görsel mi */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|m4v|webm|3gp)$/.test(clean);
}
