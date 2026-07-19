/**
 * Small subsequence-based fuzzy filter for the file switcher -- no external
 * dependency. Each query character must appear in order (case-insensitive)
 * somewhere in the candidate; matches against the basename score higher
 * than matches only in a directory segment, and prefix/exact basename
 * matches score higher than scattered ones.
 */
export function fuzzyFilter(candidates: string[], query: string, limit = 20): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return candidates.slice(0, limit);

  const scored: { path: string; score: number }[] = [];
  for (const candidate of candidates) {
    const score = scoreMatch(candidate, trimmed);
    if (score !== undefined) scored.push({ path: candidate, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.path);
}

function scoreMatch(candidate: string, query: string): number | undefined {
  const segments = candidate.toLowerCase().split('/');
  const basename = segments[segments.length - 1] ?? candidate.toLowerCase();
  const parentDir = segments[segments.length - 2];
  // Gate on basename (+ immediate parent dir, so "ops/foo"-style queries
  // can disambiguate same-named files in different dirs) rather than the
  // full absolute path -- every candidate shares the same long filesystem
  // prefix (the repo/fixture directory), so matching the full path would
  // let almost any short query spuriously match everything via letters
  // buried in that shared prefix instead of the actual filename.
  const target = parentDir ? `${parentDir}/${basename}` : basename;
  if (!isSubsequence(target, query)) return undefined;

  let score = 0;
  if (basename === query) score += 100;
  else if (basename.startsWith(query)) score += 50;
  else if (basename.includes(query)) score += 25;
  else if (isSubsequence(basename, query)) score += 10;
  else score += 1; // matched only via the parent-dir segment
  // Among otherwise-tied matches, prefer shorter (tighter) paths.
  score -= candidate.length * 0.01;
  return score;
}

function isSubsequence(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (i < needle.length && ch === needle[i]) i++;
  }
  return i === needle.length;
}
