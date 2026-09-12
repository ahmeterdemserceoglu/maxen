/**
 * Format episode titles cleanly, avoiding redundant number prefixes like "2. 2. Bölüm".
 */
export function formatEpisodeTitle(epNum: number, rawTitle?: string): string {
  if (!rawTitle || !rawTitle.trim()) return `${epNum}. Bölüm`;
  const trimmed = rawTitle.trim();

  // "2. Bölüm", "2.Bölüm", "Bölüm 2", "Episode 2", "Ep. 2", "2" gibi tekrarları yakala
  const isGenericEpisodeTitle =
    new RegExp(`^(?:${epNum}\\.?\\s*)?(?:bölüm|episode|ep\\.?)\\s*${epNum}?$`, 'i').test(trimmed) ||
    new RegExp(`^${epNum}\\.?\\s*bölüm$`, 'i').test(trimmed) ||
    trimmed === String(epNum);

  if (isGenericEpisodeTitle) {
    return `${epNum}. Bölüm`;
  }

  // Eğer başlık zaten "2. " veya "2 - " ile başlıyorsa çift numara olmasını engelle (örn: "2. Kış Geliyor" -> "2. Kış Geliyor")
  const prefixMatch = trimmed.match(new RegExp(`^${epNum}[.\\-\\s:]+\\s*(.+)`, 'i'));
  if (prefixMatch && prefixMatch[1]) {
    return `${epNum}. ${prefixMatch[1].trim()}`;
  }

  return `${epNum}. ${trimmed}`;
}
