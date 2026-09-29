import type { Shot, Vehicle } from '../types/models';

export type FeedTab = 'following' | 'foryou' | 'dyno';

export type RankableShot = Shot & {
  published_at?: string | null;
  telemetry_enabled?: boolean;
  destination?: 'club' | 'explore' | 'both';
};

export type FeedContext = {
  viewerId?: string | null;
  followingIds?: string[];
  garageMakes?: string[];
  likedHashtags?: string[];
};

const HALF_LIFE_HOURS = 36;
const MS_HOUR = 60 * 60 * 1000;

function hoursAgo(iso?: string | null): number {
  if (!iso) return 72;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 72;
  return Math.max(0, (Date.now() - t) / MS_HOUR);
}

/** Üstel zaman çürümesi — yeni içerik öne çıkar */
function recencyBoost(hours: number): number {
  return Math.exp((-Math.LN2 * hours) / HALF_LIFE_HOURS) * 40;
}

function engagementScore(s: RankableShot): number {
  const likes = s.like_count ?? 0;
  const comments = s.comment_count ?? 0;
  const bookmarks = s.bookmark_count ?? 0;
  const shares = s.share_count ?? 0;
  const views = s.view_count ?? 0;
  return (
    Math.log1p(likes) * 3 +
    Math.log1p(comments) * 5 +
    Math.log1p(bookmarks) * 4 +
    Math.log1p(shares) * 6 +
    Math.log1p(views) * 0.08
  );
}

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, '').toLowerCase().trim();
}

function hashtagAffinity(s: RankableShot, likedHashtags: string[]): number {
  if (!likedHashtags.length || !s.hashtags?.length) return 0;
  const liked = new Set(likedHashtags.map(normalizeTag));
  let hits = 0;
  for (const h of s.hashtags) {
    if (liked.has(normalizeTag(h))) hits += 1;
  }
  return Math.min(hits, 4) * 6;
}

function makeAffinity(s: RankableShot, garageMakes: string[]): number {
  if (!garageMakes.length || !s.vehicle?.make) return 0;
  const make = s.vehicle.make.toLowerCase();
  return garageMakes.some((m) => m.toLowerCase() === make) ? 12 : 0;
}

function creatorBoost(s: RankableShot): number {
  let n = 0;
  if (s.creator?.is_verified) n += 8;
  if (s.creator?.is_pro) n += 5;
  return n;
}

/** Dyno / telemetri içeriği mi? */
export function isDynoShot(s: RankableShot): boolean {
  if (s.dyno_whp != null && s.dyno_whp > 0) return true;
  if (s.zero_to_hundred != null) return true;
  if (s.telemetry_enabled && (s.speed_max != null || s.rpm_max != null || s.boost_bar != null)) {
    return true;
  }
  const cat = (s.category_tag ?? '').toLowerCase();
  if (cat.includes('dyno')) return true;
  if (s.hashtags?.some((h) => normalizeTag(h).includes('dyno'))) return true;
  const caption = (s.caption ?? '').toLowerCase();
  if (caption.includes('dyno') || caption.includes('#whp')) return true;
  return false;
}

function dynoPowerScore(s: RankableShot): number {
  const whp = s.dyno_whp ?? 0;
  const z2h = s.zero_to_hundred;
  // Daha yüksek HP iyi; 0-100 düşük saniye iyi
  const hpPart = Math.log1p(whp) * 10;
  const zPart = z2h != null && z2h > 0 ? Math.max(0, 18 - z2h) * 2.5 : 0;
  return hpPart + zPart;
}

export function scoreForYou(s: RankableShot, ctx: FeedContext): number {
  const hours = hoursAgo(s.published_at);
  let score =
    engagementScore(s) +
    recencyBoost(hours) +
    creatorBoost(s) +
    hashtagAffinity(s, ctx.likedHashtags ?? []) +
    makeAffinity(s, ctx.garageMakes ?? []);

  // Explore / both biraz öne; sadece club biraz geri
  if (s.destination === 'explore' || s.destination === 'both') score += 4;
  if (s.destination === 'club') score -= 2;

  // Kendi shot’unu hafif bastır (keşif için)
  if (ctx.viewerId && s.creator_id === ctx.viewerId) score -= 15;

  // Telemetri/dyno çeşitlilik katsayısı
  if (isDynoShot(s)) score += 3;

  return score;
}

export function scoreDyno(s: RankableShot, ctx: FeedContext): number {
  const hours = hoursAgo(s.published_at);
  return (
    dynoPowerScore(s) * 1.4 +
    engagementScore(s) * 0.7 +
    recencyBoost(hours) * 0.6 +
    creatorBoost(s) +
    makeAffinity(s, ctx.garageMakes ?? [])
  );
}

/**
 * Aynı creator’ın peş peşe gelmesini azaltır (greedy diversity).
 */
export function diversifyByCreator<T extends RankableShot>(
  ranked: T[],
  limit = 40,
  windowSize = 2,
): T[] {
  const pool = [...ranked];
  const out: T[] = [];
  const recentCreators: string[] = [];

  while (out.length < limit && pool.length > 0) {
    let pickIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i].creator_id;
      if (!recentCreators.includes(c)) {
        pickIdx = i;
        break;
      }
    }
    const [picked] = pool.splice(pickIdx, 1);
    out.push(picked);
    recentCreators.push(picked.creator_id);
    if (recentCreators.length > windowSize) recentCreators.shift();
  }

  return out;
}

export function rankForYouFeed<T extends RankableShot>(shots: T[], ctx: FeedContext): T[] {
  const scored = [...shots].sort(
    (a, b) => scoreForYou(b, ctx) - scoreForYou(a, ctx),
  );
  return diversifyByCreator(scored, 40, 2);
}

export function rankDynoFeed<T extends RankableShot>(shots: T[], ctx: FeedContext): T[] {
  const dynoOnly = shots.filter(isDynoShot);
  const scored = dynoOnly.sort((a, b) => scoreDyno(b, ctx) - scoreDyno(a, ctx));
  return diversifyByCreator(scored, 40, 3);
}

/** Takip: kronolojik (en yeni üstte) */
export function rankFollowingFeed<T extends RankableShot>(shots: T[]): T[] {
  return [...shots].sort((a, b) => {
    const ta = new Date(a.published_at ?? 0).getTime();
    const tb = new Date(b.published_at ?? 0).getTime();
    return tb - ta;
  });
}

export function garageMakesFromVehicles(vehicles: Vehicle[]): string[] {
  const set = new Set<string>();
  for (const v of vehicles) {
    if (v.make?.trim()) set.add(v.make.trim());
  }
  return [...set];
}
