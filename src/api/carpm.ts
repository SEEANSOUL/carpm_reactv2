import { fuelCostTry, fuelLiters } from '../lib/driveFormat';
import { requireSupabase } from '../lib/supabase';
import { mapAuthError } from '../lib/authErrors';
import type { FeedTab } from '../lib/feedAlgorithm';
import {
  garageMakesFromVehicles,
  rankDynoFeed,
  rankFollowingFeed,
  rankForYouFeed,
} from '../lib/feedAlgorithm';
import type {
  Badge,
  Category,
  Club,
  ClubPost,
  EventItem,
  Profile,
  Shot,
  Vehicle,
  AppNotification,
  ClubPostReply,
  DriveLog,
} from '../types/models';

export type { FeedTab };

export type ShotComment = {
  id: string;
  shot_id: string;
  user_id: string;
  body: string;
  created_at: string;
  user?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
};

const PROFILE_SELECT =
  'id, username, full_name, avatar_url, bio, title, is_pro, is_verified, follower_count, following_count, like_count, vehicle_count, badge_count';

function mapVehicles(rows: Record<string, unknown>[]): Vehicle[] {
  return rows.map((row) => {
    const modRows = (row.mods as { id?: string; name: string }[] | null) ?? [];
    const { mods: _m, ...rest } = row;
    return {
      ...(rest as unknown as Vehicle),
      mods: modRows.map((m) => m.name),
      mod_ids: modRows.map((m) => m.id).filter(Boolean) as string[],
    } as Vehicle & { mod_ids?: string[] };
  });
}

// ─── Categories ─────────────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('categories')
    .select('id, slug, name')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

// ─── Profiles ───────────────────────────────────────────────
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<Profile, 'full_name' | 'username' | 'bio' | 'title' | 'avatar_url'>
  >,
): Promise<Profile> {
  const client = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.full_name !== undefined) payload.full_name = patch.full_name?.trim() || null;
  if (patch.bio !== undefined) payload.bio = patch.bio?.trim() || null;
  if (patch.title !== undefined) payload.title = patch.title?.trim() || null;
  if (patch.avatar_url !== undefined) payload.avatar_url = patch.avatar_url?.trim() || null;
  if (patch.username !== undefined) {
    payload.username = patch.username.trim().toLowerCase();
  }

  const { data, error } = await client
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchUserBadges(userId: string): Promise<Badge[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('user_badges')
    .select('achievement_value, badge:badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const b = row.badge as unknown as Badge | null;
      if (!b || typeof b !== 'object' || !('id' in b)) return null;
      return { ...b, achievement_value: row.achievement_value as string | null } as Badge;
    })
    .filter((b): b is Badge => b != null);
}

// ─── Vehicles ───────────────────────────────────────────────
export async function fetchMyVehicles(userId: string): Promise<Vehicle[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('vehicles')
    .select('*, mods:vehicle_mods(id, name)')
    .eq('owner_id', userId)
    .order('garage_number', { ascending: true });
  if (error) throw error;
  return mapVehicles((data ?? []) as Record<string, unknown>[]);
}

export async function createVehicle(input: {
  owner_id: string;
  make: string;
  model: string;
  year?: number | null;
  vehicle_type?: 'car' | 'motorcycle';
  hp?: number | null;
  torque_nm?: number | null;
  zero_to_hundred?: number | null;
  engine_code?: string | null;
  body_type?: string | null;
  ecu_map?: string | null;
  exhaust_db?: number | null;
  image_url?: string | null;
  is_active?: boolean;
  badges?: string[];
}): Promise<Vehicle> {
  const client = requireSupabase();
  if (input.is_active) {
    await client.from('vehicles').update({ is_active: false }).eq('owner_id', input.owner_id);
  }
  const { data, error } = await client
    .from('vehicles')
    .insert({
      owner_id: input.owner_id,
      make: input.make.trim(),
      model: input.model.trim(),
      year: input.year ?? null,
      vehicle_type: input.vehicle_type ?? 'car',
      hp: input.hp ?? null,
      torque_nm: input.torque_nm ?? null,
      zero_to_hundred: input.zero_to_hundred ?? null,
      engine_code: input.engine_code ?? null,
      body_type: input.body_type ?? null,
      ecu_map: input.ecu_map ?? null,
      exhaust_db: input.exhaust_db ?? null,
      image_url: input.image_url ?? null,
      is_active: input.is_active ?? false,
      badges: input.badges ?? [],
    })
    .select('*')
    .single();
  if (error) throw error;

  const { count } = await client
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', input.owner_id);
  if (count != null) {
    await client.from('profiles').update({ vehicle_count: count }).eq('id', input.owner_id);
  }

  return data as Vehicle;
}

export async function updateVehicle(
  vehicleId: string,
  ownerId: string,
  patch: Partial<{
    make: string;
    model: string;
    year: number | null;
    vehicle_type: 'car' | 'motorcycle';
    hp: number | null;
    torque_nm: number | null;
    zero_to_hundred: number | null;
    engine_code: string | null;
    body_type: string | null;
    ecu_map: string | null;
    exhaust_db: number | null;
    image_url: string | null;
    is_active: boolean;
    badges: string[];
    garage_number: number | null;
    fuel_l_per_100km: number | null;
    fuel_price_try: number | null;
  }>,
): Promise<Vehicle> {
  const client = requireSupabase();
  if (patch.is_active === true) {
    await client.from('vehicles').update({ is_active: false }).eq('owner_id', ownerId);
  }
  const { data, error } = await client
    .from('vehicles')
    .update(patch)
    .eq('id', vehicleId)
    .eq('owner_id', ownerId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Vehicle;
}

export async function deleteVehicle(vehicleId: string, ownerId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)
    .eq('owner_id', ownerId);
  if (error) throw error;

  const { count } = await client
    .from('vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId);
  if (count != null) {
    await client.from('profiles').update({ vehicle_count: count }).eq('id', ownerId);
  }
}

export async function addVehicleMod(vehicleId: string, name: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('vehicle_mods')
    .insert({ vehicle_id: vehicleId, name: name.trim() })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVehicleMod(modId: string) {
  const client = requireSupabase();
  const { error } = await client.from('vehicle_mods').delete().eq('id', modId);
  if (error) throw error;
}

// ─── Follows ────────────────────────────────────────────────
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.following_id as string);
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('follows')
    .select('following_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleFollow(
  followerId: string,
  followingId: string,
  currentlyFollowing: boolean,
): Promise<void> {
  if (followerId === followingId) {
    throw new Error('Kendini takip edemezsin.');
  }
  const client = requireSupabase();
  if (currentlyFollowing) {
    const { error } = await client
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) throw error;
  } else {
    const { error } = await client.from('follows').insert({
      follower_id: followerId,
      following_id: followingId,
    });
    if (error) throw error;
  }
}

// ─── Shots ──────────────────────────────────────────────────
const SHOT_FEED_SELECT =
  `*, creator:profiles!shots_creator_id_fkey(*), vehicle:vehicles(*), club:clubs(*)`;

async function attachViewerFlags<T extends Shot>(
  shots: T[],
  viewerId?: string,
): Promise<(T & { liked_by_me?: boolean; bookmarked_by_me?: boolean })[]> {
  if (!viewerId || shots.length === 0) return shots;
  const client = requireSupabase();
  const ids = shots.map((s) => s.id);
  const [{ data: likes }, { data: bookmarks }] = await Promise.all([
    client.from('shot_likes').select('shot_id').eq('user_id', viewerId).in('shot_id', ids),
    client
      .from('shot_bookmarks')
      .select('shot_id')
      .eq('user_id', viewerId)
      .in('shot_id', ids),
  ]);
  const liked = new Set((likes ?? []).map((l) => l.shot_id));
  const booked = new Set((bookmarks ?? []).map((b) => b.shot_id));
  return shots.map((s) => ({
    ...s,
    liked_by_me: liked.has(s.id),
    bookmarked_by_me: booked.has(s.id),
  }));
}

async function fetchViewerAffinity(viewerId: string): Promise<{
  garageMakes: string[];
  likedHashtags: string[];
  followingIds: string[];
}> {
  const client = requireSupabase();
  const [vehicles, followingIds] = await Promise.all([
    fetchMyVehicles(viewerId).catch(() => [] as Vehicle[]),
    fetchFollowingIds(viewerId).catch(() => [] as string[]),
  ]);

  let likedHashtags: string[] = [];
  try {
    const { data: likedRows } = await client
      .from('shot_likes')
      .select('shot_id, shots!inner(hashtags)')
      .eq('user_id', viewerId)
      .limit(40);

    const tagCount = new Map<string, number>();
    for (const row of (likedRows ?? []) as { shots?: { hashtags?: string[] } | null }[]) {
      const tags = row.shots?.hashtags ?? [];
      for (const t of tags) {
        const key = t.replace(/^#/, '').toLowerCase();
        if (!key) continue;
        tagCount.set(key, (tagCount.get(key) ?? 0) + 1);
      }
    }
    likedHashtags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  } catch {
    likedHashtags = [];
  }

  return {
    garageMakes: garageMakesFromVehicles(vehicles),
    likedHashtags,
    followingIds,
  };
}

export async function fetchShotsFeed(
  viewerId?: string,
  mode: FeedTab = 'foryou',
  opts?: { limit?: number; offset?: number },
): Promise<{
  items: (Shot & { liked_by_me?: boolean; bookmarked_by_me?: boolean })[];
  hasMore: boolean;
  nextOffset: number;
}> {
  const client = requireSupabase();
  const limit = Math.min(Math.max(opts?.limit ?? 15, 5), 40);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const ctxBase = viewerId
    ? await fetchViewerAffinity(viewerId)
    : { garageMakes: [] as string[], likedHashtags: [] as string[], followingIds: [] as string[] };

  const feedCtx = {
    viewerId,
    garageMakes: ctxBase.garageMakes,
    likedHashtags: ctxBase.likedHashtags,
    followingIds: ctxBase.followingIds,
  };

  if (mode === 'following') {
    if (!viewerId) return { items: [], hasMore: false, nextOffset: offset };
    const ids = ctxBase.followingIds;
    if (ids.length === 0) return { items: [], hasMore: false, nextOffset: offset };

    const { data, error } = await client
      .from('shots')
      .select(SHOT_FEED_SELECT)
      .eq('is_draft', false)
      .in('creator_id', ids)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const ranked = rankFollowingFeed((data ?? []) as Shot[]);
    const items = await attachViewerFlags(ranked, viewerId);
    return {
      items,
      hasMore: (data ?? []).length >= limit,
      nextOffset: offset + (data ?? []).length,
    };
  }

  // foryou: sayfa penceresi çek → skorla
  // dyno: daha geniş pencere çek, dyno olanları filtrele
  const fetchSize = mode === 'dyno' ? limit * 4 : limit;
  const { data, error } = await client
    .from('shots')
    .select(SHOT_FEED_SELECT)
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .range(offset, offset + fetchSize - 1);
  if (error) throw error;

  const pool = (data ?? []) as Shot[];
  const ranked =
    mode === 'dyno' ? rankDynoFeed(pool, feedCtx) : rankForYouFeed(pool, feedCtx);
  const page = ranked.slice(0, limit);
  const items = await attachViewerFlags(page, viewerId);

  return {
    items,
    hasMore: pool.length >= fetchSize,
    nextOffset: offset + pool.length,
  };
}

export async function fetchUserShots(userId: string): Promise<Shot[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shots')
    .select('*, vehicle:vehicles(*), club:clubs(*)')
    .eq('creator_id', userId)
    .eq('is_draft', false)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Shot[];
}

export async function publishShot(payload: {
  creator_id: string;
  vehicle_id?: string | null;
  club_id?: string | null;
  caption: string;
  hashtags: string[];
  video_url: string;
  thumbnail_url?: string | null;
  audio_title?: string | null;
  audio_source?: 'original' | 'soundbank' | null;
  destination?: 'club' | 'explore' | 'both';
  category_tag?: string | null;
  telemetry_enabled?: boolean;
  speed_max?: number | null;
  boost_bar?: number | null;
  rpm_max?: number | null;
  zero_to_hundred?: number | null;
  dyno_whp?: number | null;
  exhaust_db?: number | null;
  ecu_map?: string | null;
}) {
  const client = requireSupabase();

  // Boş opsiyonelleri hiç yazma
  const row: Record<string, unknown> = {
    creator_id: payload.creator_id,
    caption: payload.caption,
    hashtags: payload.hashtags,
    video_url: payload.video_url,
    thumbnail_url: payload.thumbnail_url ?? null,
    destination: payload.destination ?? 'explore',
    telemetry_enabled: payload.telemetry_enabled ?? false,
    is_draft: false,
    published_at: new Date().toISOString(),
  };

  if (payload.vehicle_id) row.vehicle_id = payload.vehicle_id;
  if (payload.club_id) row.club_id = payload.club_id;
  if (payload.category_tag) row.category_tag = payload.category_tag;
  if (payload.audio_title) {
    row.audio_title = payload.audio_title;
    if (payload.audio_source) row.audio_source = payload.audio_source;
  } else {
    row.audio_title = null;
    row.audio_source = null;
  }
  if (payload.telemetry_enabled) {
    if (payload.speed_max != null) row.speed_max = payload.speed_max;
    if (payload.boost_bar != null) row.boost_bar = payload.boost_bar;
    if (payload.rpm_max != null) row.rpm_max = payload.rpm_max;
    if (payload.zero_to_hundred != null) row.zero_to_hundred = payload.zero_to_hundred;
    if (payload.dyno_whp != null) row.dyno_whp = payload.dyno_whp;
    if (payload.exhaust_db != null) row.exhaust_db = payload.exhaust_db;
    if (payload.ecu_map) row.ecu_map = payload.ecu_map;
  }

  const { data, error } = await client.from('shots').insert(row).select('id').single();
  if (error) throw new Error(mapAuthError(error));
  return data;
}

export async function updateShot(
  shotId: string,
  creatorId: string,
  patch: Partial<{ caption: string; hashtags: string[]; thumbnail_url: string | null }>,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shots')
    .update(patch)
    .eq('id', shotId)
    .eq('creator_id', creatorId)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShot(shotId: string, creatorId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('shots')
    .delete()
    .eq('id', shotId)
    .eq('creator_id', creatorId);
  if (error) throw error;
}

export async function toggleShotLike(shotId: string, userId: string, liked: boolean) {
  const client = requireSupabase();

  if (liked) {
    const { error } = await client
      .from('shot_likes')
      .delete()
      .eq('shot_id', shotId)
      .eq('user_id', userId);
    if (error) throw new Error(mapAuthError(error));
    return false;
  }

  // Çift tıklamada duplicate yerine sessizce OK
  const { error } = await client.from('shot_likes').upsert(
    { shot_id: shotId, user_id: userId },
    { onConflict: 'user_id,shot_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(mapAuthError(error));
  return true;
}

export async function toggleShotBookmark(
  shotId: string,
  userId: string,
  bookmarked: boolean,
) {
  const client = requireSupabase();
  if (bookmarked) {
    const { error } = await client
      .from('shot_bookmarks')
      .delete()
      .eq('shot_id', shotId)
      .eq('user_id', userId);
    if (error) throw new Error(mapAuthError(error));
    return false;
  }
  const { error } = await client.from('shot_bookmarks').upsert(
    { shot_id: shotId, user_id: userId },
    { onConflict: 'user_id,shot_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(mapAuthError(error));
  return true;
}

export async function fetchShotComments(shotId: string): Promise<ShotComment[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shot_comments')
    .select('*, user:profiles!shot_comments_user_id_fkey(id, username, avatar_url, full_name)')
    .eq('shot_id', shotId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShotComment[];
}

export async function addShotComment(shotId: string, userId: string, body: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('shot_comments')
    .insert({ shot_id: shotId, user_id: userId, body: body.trim() })
    .select('*, user:profiles!shot_comments_user_id_fkey(id, username, avatar_url, full_name)')
    .single();
  if (error) throw error;

  const { count } = await client
    .from('shot_comments')
    .select('*', { count: 'exact', head: true })
    .eq('shot_id', shotId);
  if (count != null) {
    await client.from('shots').update({ comment_count: count }).eq('id', shotId);
  }

  return data as ShotComment;
}

export async function deleteShotComment(commentId: string, userId: string, shotId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('shot_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;

  const { count } = await client
    .from('shot_comments')
    .select('*', { count: 'exact', head: true })
    .eq('shot_id', shotId);
  if (count != null) {
    await client.from('shots').update({ comment_count: count }).eq('id', shotId);
  }
}

// ─── Clubs ──────────────────────────────────────────────────
export async function fetchClubs(categorySlug?: string): Promise<Club[]> {
  const client = requireSupabase();
  let query = client.from('clubs').select('*').order('member_count', { ascending: false });

  if (categorySlug && categorySlug !== 'all') {
    const { data: cat } = await client
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .maybeSingle();
    if (cat?.id) {
      const { data: links, error: linkErr } = await client
        .from('club_categories')
        .select('club_id')
        .eq('category_id', cat.id);
      if (linkErr) throw linkErr;
      const ids = (links ?? []).map((l) => l.club_id);
      if (ids.length === 0) return [];
      query = client
        .from('clubs')
        .select('*')
        .in('id', ids)
        .order('member_count', { ascending: false });
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Club[];
}

export async function fetchFeaturedClub(): Promise<Club | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('clubs')
    .select('*')
    .order('member_count', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Club) ?? null;
}

export async function fetchClub(clubId: string): Promise<Club | null> {
  const client = requireSupabase();
  const { data, error } = await client.from('clubs').select('*').eq('id', clubId).maybeSingle();
  if (error) throw error;
  return data as Club | null;
}

export async function createClub(input: {
  created_by: string;
  name: string;
  description?: string;
  location?: string;
  logo_url?: string;
  banner_url?: string;
  tags?: string[];
}): Promise<Club> {
  const client = requireSupabase();
  const base = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const slug = `${base || 'club'}-${Date.now().toString(36)}`;

  const { data, error } = await client
    .from('clubs')
    .insert({
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      banner_url: input.banner_url?.trim() || null,
      tags: input.tags ?? [],
      created_by: input.created_by,
      member_count: 0,
    })
    .select('*')
    .single();
  if (error) throw error;

  await client.from('club_members').insert({
    club_id: data.id,
    user_id: input.created_by,
    role: 'owner',
    status: 'approved',
  });

  return data as Club;
}

export async function updateClub(
  clubId: string,
  patch: Partial<Pick<Club, 'name' | 'description' | 'location' | 'logo_url' | 'banner_url' | 'tags' | 'recent_activity'>>,
) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('clubs')
    .update(patch)
    .eq('id', clubId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Club;
}

export async function deleteClub(clubId: string) {
  const client = requireSupabase();
  const { error } = await client.from('clubs').delete().eq('id', clubId);
  if (error) throw error;
}

export async function joinClub(clubId: string, userId: string) {
  const client = requireSupabase();
  const { data: existing } = await client
    .from('club_members')
    .select('id, status, role')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.status === 'approved') return 'approved' as const;
  if (existing?.status === 'pending') return 'pending' as const;

  if (existing) {
    const { error } = await client
      .from('club_members')
      .update({ status: 'pending', role: 'member' })
      .eq('id', existing.id);
    if (error) throw error;
    return 'pending' as const;
  }

  const { error } = await client.from('club_members').insert({
    club_id: clubId,
    user_id: userId,
    role: 'member',
    status: 'pending',
  });
  if (error) throw error;
  return 'pending' as const;
}

export async function leaveClub(clubId: string, userId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId);
  if (error) throw error;
}

export type ClubMembershipStatus = 'none' | 'pending' | 'approved' | 'rejected';

export async function getClubMembershipStatus(
  clubId: string,
  userId: string,
): Promise<ClubMembershipStatus> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 'none';
  const s = data.status as string;
  if (s === 'approved' || s === 'pending' || s === 'rejected') return s;
  return 'approved';
}

export async function isClubMember(clubId: string, userId: string): Promise<boolean> {
  const status = await getClubMembershipStatus(clubId, userId);
  return status === 'approved';
}

/** Kullanıcının üye olduğu (onaylı) kulüp id’leri */
export async function fetchMyClubIds(userId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId)
    .eq('status', 'approved');
  if (error) {
    // status kolonu yoksa eski şema fallback
    const fallback = await client
      .from('club_members')
      .select('club_id')
      .eq('user_id', userId);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((r) => r.club_id as string);
  }
  return (data ?? []).map((r) => r.club_id as string);
}

export type PendingClubMember = {
  id: string;
  user_id: string;
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
};

export async function fetchPendingClubMembers(
  clubId: string,
): Promise<PendingClubMember[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('club_members')
    .select(
      'id, user_id, joined_at, profile:profiles!club_members_user_id_fkey(id, username, avatar_url, full_name)',
    )
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('joined_at', { ascending: true });

  const rows = error
    ? await client
        .from('club_members')
        .select(
          'id, user_id, joined_at, profile:profiles!user_id(id, username, avatar_url, full_name)',
        )
        .eq('club_id', clubId)
        .eq('status', 'pending')
        .order('joined_at', { ascending: true })
    : { data, error: null as null };

  if (rows.error) throw rows.error;

  return (rows.data ?? []).map((row: Record<string, unknown>) => {
    const raw = row.profile;
    const profile = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      joined_at: row.joined_at as string,
      profile: profile as PendingClubMember['profile'],
    };
  });
}

export async function setClubMemberStatus(
  clubId: string,
  memberUserId: string,
  status: 'approved' | 'rejected',
) {
  const client = requireSupabase();
  const { error } = await client
    .from('club_members')
    .update({ status })
    .eq('club_id', clubId)
    .eq('user_id', memberUserId);
  if (error) throw error;
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\wğüşıöçĞÜŞİÖÇ]+/gi) ?? [];
  return [...new Set(matches.map((t) => t.toLowerCase()))];
}

export async function fetchClubPosts(
  clubId: string,
  viewerId?: string,
  tag?: string | null,
): Promise<ClubPost[]> {
  const client = requireSupabase();
  let query = client
    .from('club_posts')
    .select(
      '*, author:profiles!club_posts_author_id_fkey(id, username, avatar_url, full_name)',
    )
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (tag) {
    const normalized = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
    query = query.contains('hashtags', [normalized]);
  }

  const { data, error } = await query;
  if (error) throw error;
  const posts = (data ?? []) as ClubPost[];
  if (!viewerId || posts.length === 0) return posts;

  const ids = posts.map((p) => p.id);
  const { data: likes } = await client
    .from('club_post_likes')
    .select('post_id')
    .eq('user_id', viewerId)
    .in('post_id', ids);
  const liked = new Set((likes ?? []).map((l) => l.post_id));
  return posts.map((p) => ({ ...p, liked_by_me: liked.has(p.id) }));
}

export async function createClubPost(input: {
  club_id: string;
  author_id: string;
  body: string;
  image_url?: string | null;
}): Promise<ClubPost> {
  const client = requireSupabase();
  const body = input.body.trim();
  if (!body) throw new Error('Yazı boş olamaz.');
  const hashtags = extractHashtags(body);

  const { data, error } = await client
    .from('club_posts')
    .insert({
      club_id: input.club_id,
      author_id: input.author_id,
      body,
      image_url: input.image_url ?? null,
      hashtags,
    })
    .select(
      '*, author:profiles!club_posts_author_id_fkey(id, username, avatar_url, full_name)',
    )
    .single();
  if (error) throw error;

  try {
    await client
      .from('clubs')
      .update({ recent_activity: 'Yeni forum gönderisi' })
      .eq('id', input.club_id);
  } catch {
    // non-blocking
  }

  return data as ClubPost;
}

export async function updateClubPost(
  postId: string,
  patch: { body: string; image_url?: string | null },
): Promise<ClubPost> {
  const client = requireSupabase();
  const body = patch.body.trim();
  if (!body) throw new Error('Yazı boş olamaz.');
  const hashtags = extractHashtags(body);
  const { data, error } = await client
    .from('club_posts')
    .update({
      body,
      image_url: patch.image_url ?? null,
      hashtags,
    })
    .eq('id', postId)
    .select(
      '*, author:profiles!club_posts_author_id_fkey(id, username, avatar_url, full_name)',
    )
    .single();
  if (error) throw error;
  return data as ClubPost;
}

export async function deleteClubPost(postId: string) {
  const client = requireSupabase();
  const { error } = await client.from('club_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function fetchClubPost(
  postId: string,
  viewerId?: string,
): Promise<ClubPost | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('club_posts')
    .select(
      '*, author:profiles!club_posts_author_id_fkey(id, username, avatar_url, full_name)',
    )
    .eq('id', postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const post = data as ClubPost;
  if (!viewerId) return post;
  const { data: like } = await client
    .from('club_post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', viewerId)
    .maybeSingle();
  return { ...post, liked_by_me: !!like };
}

export async function fetchClubPostReplies(postId: string): Promise<ClubPostReply[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('club_post_replies')
    .select(
      '*, author:profiles!club_post_replies_author_id_fkey(id, username, avatar_url, full_name)',
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) {
    const fallback = await client
      .from('club_post_replies')
      .select('*, author:profiles!author_id(id, username, avatar_url, full_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as ClubPostReply[];
  }
  return (data ?? []) as ClubPostReply[];
}

export async function addClubPostReply(input: {
  post_id: string;
  club_id: string;
  author_id: string;
  body: string;
}): Promise<ClubPostReply> {
  const client = requireSupabase();
  const body = input.body.trim();
  if (!body) throw new Error('Yanıt boş olamaz.');

  const { data, error } = await client
    .from('club_post_replies')
    .insert({
      post_id: input.post_id,
      club_id: input.club_id,
      author_id: input.author_id,
      body,
    })
    .select(
      '*, author:profiles!club_post_replies_author_id_fkey(id, username, avatar_url, full_name)',
    )
    .single();

  if (error) {
    const fallback = await client
      .from('club_post_replies')
      .insert({
        post_id: input.post_id,
        club_id: input.club_id,
        author_id: input.author_id,
        body,
      })
      .select('*, author:profiles!author_id(id, username, avatar_url, full_name)')
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data as ClubPostReply;
  }
  return data as ClubPostReply;
}

export async function deleteClubPostReply(replyId: string) {
  const client = requireSupabase();
  const { error } = await client.from('club_post_replies').delete().eq('id', replyId);
  if (error) throw error;
}

export async function toggleClubPostLike(
  postId: string,
  userId: string,
  liked: boolean,
) {
  const client = requireSupabase();
  if (liked) {
    const { error } = await client
      .from('club_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from('club_post_likes').upsert(
    { post_id: postId, user_id: userId },
    { onConflict: 'user_id,post_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  return true;
}

export async function fetchClubPostTags(clubId: string): Promise<string[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('club_posts')
    .select('hashtags')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const tag of (row.hashtags as string[] | null) ?? []) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([t]) => t);
}

// ─── Events ─────────────────────────────────────────────────
export async function fetchLiveOrUpcomingEvents(): Promise<EventItem[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('events')
    .select('*, club:clubs(*), track:tracks(*)')
    .or('is_live.eq.true,start_time.gte.' + new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as EventItem[];
}

export async function fetchEvent(eventId: string): Promise<EventItem | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('events')
    .select('*, club:clubs(*), track:tracks(*)')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data as EventItem | null;
}

export async function createEvent(input: {
  created_by: string;
  club_id?: string | null;
  title: string;
  subtitle?: string;
  event_type?: EventItem['event_type'];
  start_time: string;
  location_name?: string;
  banner_url?: string;
  is_live?: boolean;
  is_featured?: boolean;
}): Promise<EventItem> {
  if (!input.club_id) {
    throw new Error('Etkinlik için kulüp seçilmeli.');
  }
  const club = await fetchClub(input.club_id);
  if (!club) throw new Error('Kulüp bulunamadı.');
  if (club.created_by !== input.created_by) {
    throw new Error('Etkinliği sadece kulüp kurucusu oluşturabilir.');
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('events')
    .insert({
      created_by: input.created_by,
      club_id: input.club_id,
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      event_type: input.event_type ?? 'meetup',
      start_time: input.start_time,
      location_name: input.location_name?.trim() || null,
      banner_url: input.banner_url?.trim() || null,
      is_live: input.is_live ?? false,
      is_featured: input.is_featured ?? true,
    })
    .select('*, club:clubs(*), track:tracks(*)')
    .single();
  if (error) throw error;
  return data as EventItem;
}

export async function updateEvent(
  eventId: string,
  userId: string,
  patch: Partial<{
    title: string;
    subtitle: string | null;
    event_type: EventItem['event_type'];
    start_time: string;
    location_name: string | null;
    is_live: boolean;
    is_featured: boolean;
  }>,
) {
  const client = requireSupabase();
  const existing = await fetchEvent(eventId);
  if (!existing) throw new Error('Etkinlik bulunamadı.');
  if (existing.club_id) {
    const club = await fetchClub(existing.club_id);
    if (club?.created_by !== userId) {
      throw new Error('Etkinliği sadece kulüp kurucusu düzenleyebilir.');
    }
  }

  const { data, error } = await client
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select('*, club:clubs(*), track:tracks(*)')
    .single();
  if (error) throw error;
  return data as EventItem;
}

export async function deleteEvent(eventId: string) {
  const client = requireSupabase();
  const { error } = await client.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function rsvpEvent(eventId: string, userId: string) {
  const client = requireSupabase();
  const { error } = await client.from('event_participants').upsert(
    { event_id: eventId, user_id: userId, status: 'going' },
    { onConflict: 'event_id,user_id' },
  );
  if (error) throw error;
}

export async function cancelRsvp(eventId: string, userId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Notifications ──────────────────────────────────────────
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('notifications')
    .select(
      '*, actor:profiles!notifications_actor_id_fkey(id, username, avatar_url, full_name)',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) {
    const fallback = await client
      .from('notifications')
      .select('*, actor:profiles!actor_id(id, username, avatar_url, full_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(80);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as AppNotification[];
  }
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const client = requireSupabase();
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string, userId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const client = requireSupabase();
  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

// ─── Arena (araç oylama) ────────────────────────────────────
export type ArenaVotePayload = {
  vehicle_id: string;
  vote: 1 | -1;
};

export type ArenaVehicle = Vehicle & {
  owner?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
};

export async function fetchArenaDeck(
  limit = 10,
  excludeIds: string[] = [],
): Promise<ArenaVehicle[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('arena_fetch_deck', {
    p_limit: limit,
    p_exclude: excludeIds,
  });
  if (error) throw new Error(mapAuthError(error));

  const rows = (data ?? []) as Vehicle[];
  if (rows.length === 0) return [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
  let owners = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'>>();

  if (ownerIds.length > 0) {
    const { data: profiles, error: pErr } = await client
      .from('profiles')
      .select('id, username, avatar_url, full_name')
      .in('id', ownerIds);
    if (!pErr && profiles) {
      owners = new Map(
        profiles.map((p) => [
          p.id,
          p as Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'>,
        ]),
      );
    }
  }

  return rows.map((v) => ({
    ...v,
    owner: owners.get(v.owner_id) ?? null,
  }));
}

export async function fetchArenaLeaderboard(limit = 50): Promise<ArenaVehicle[]> {
  const client = requireSupabase();
  let rows: Vehicle[] = [];

  const { data, error } = await client.rpc('arena_leaderboard', {
    p_limit: limit,
  });

  if (error) {
    // RPC henüz yoksa doğrudan tabloya düş
    const fallback = await client
      .from('vehicles')
      .select('*')
      .not('image_url', 'is', null)
      .order('arena_score', { ascending: false })
      .order('arena_likes', { ascending: false })
      .limit(limit);
    if (fallback.error) throw new Error(mapAuthError(error));
    rows = ((fallback.data ?? []) as Vehicle[]).filter(
      (v) => (v.arena_likes ?? 0) + (v.arena_passes ?? 0) > 0,
    );
  } else {
    rows = (data ?? []) as Vehicle[];
  }

  if (rows.length === 0) return [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
  let owners = new Map<string, Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'>>();

  if (ownerIds.length > 0) {
    const { data: profiles, error: pErr } = await client
      .from('profiles')
      .select('id, username, avatar_url, full_name')
      .in('id', ownerIds);
    if (!pErr && profiles) {
      owners = new Map(
        profiles.map((p) => [
          p.id,
          p as Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'>,
        ]),
      );
    }
  }

  return rows.map((v) => ({
    ...v,
    owner: owners.get(v.owner_id) ?? null,
  }));
}

export async function batchSubmitArenaVotes(votes: ArenaVotePayload[]): Promise<number> {
  if (votes.length === 0) return 0;
  const client = requireSupabase();
  const { data, error } = await client.rpc('arena_batch_votes', {
    p_votes: votes,
  });
  if (error) throw new Error(mapAuthError(error));
  return (data as number) ?? 0;
}

function downsampleRoute<T>(points: T[], maxPoints = 800): T[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    result.push(points[Math.floor(i * step)]);
  }
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

function mapDriveLog(row: Record<string, unknown>): DriveLog {
  const raw = row.route;
  const route = Array.isArray(raw)
    ? raw
        .map((point) => {
          if (!point || typeof point !== 'object') return null;
          const latitude = Number((point as { latitude?: unknown }).latitude);
          const longitude = Number((point as { longitude?: unknown }).longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          return { latitude, longitude };
        })
        .filter((point): point is DriveLog['route'][number] => point != null)
    : [];

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    started_at: String(row.started_at),
    ended_at: String(row.ended_at),
    total_distance_km: Number(row.total_distance_km) || 0,
    max_speed_kmh: Number(row.max_speed_kmh) || 0,
    average_speed_kmh: Number(row.average_speed_kmh) || 0,
    duration_seconds: Number(row.duration_seconds) || 0,
    route,
    created_at: String(row.created_at),
    vehicle_id: row.vehicle_id ? String(row.vehicle_id) : null,
    vehicle_label: row.vehicle_label ? String(row.vehicle_label) : null,
    vehicle_image_url: row.vehicle_image_url ? String(row.vehicle_image_url) : null,
    fuel_liters: row.fuel_liters == null ? null : Number(row.fuel_liters) || 0,
    fuel_cost_try: row.fuel_cost_try == null ? null : Number(row.fuel_cost_try) || 0,
    fuel_l_per_100km: row.fuel_l_per_100km == null ? null : Number(row.fuel_l_per_100km) || 0,
  };
}

const DRIVE_LOG_COLUMNS =
  'id, user_id, started_at, ended_at, total_distance_km, max_speed_kmh, average_speed_kmh, duration_seconds, route, created_at, vehicle_id, vehicle_label, vehicle_image_url, fuel_liters, fuel_cost_try, fuel_l_per_100km';
const DRIVE_LOG_COLUMNS_BASE =
  'id, user_id, started_at, ended_at, total_distance_km, max_speed_kmh, average_speed_kmh, duration_seconds, route, created_at';

export async function fetchMyDriveLogs(userId: string): Promise<DriveLog[]> {
  const client = requireSupabase();
  const first = await client
    .from('drive_logs')
    .select(DRIVE_LOG_COLUMNS)
    .eq('user_id', userId)
    .order('ended_at', { ascending: false })
    .limit(30);
  const query =
    first.error && /column|schema cache/i.test(first.error.message)
      ? await client
          .from('drive_logs')
          .select(DRIVE_LOG_COLUMNS_BASE)
          .eq('user_id', userId)
          .order('ended_at', { ascending: false })
          .limit(30)
      : first;
  if (query.error) throw new Error(mapAuthError(query.error));
  return (query.data ?? []).map((row) => mapDriveLog(row as Record<string, unknown>));
}

export async function saveDriveLog(
  userId: string,
  session: {
    startedAt: string;
    endedAt: string;
    totalDistanceKm: number;
    maxSpeedKmh: number;
    averageSpeedKmh: number;
    durationSeconds: number;
    route: { latitude: number; longitude: number }[];
    vehicle?: {
      id: string;
      label: string;
      imageUrl?: string | null;
      lPer100km: number;
      priceTry: number;
    } | null;
  },
): Promise<string> {
  if (session.route.length < 2 || session.totalDistanceKm < 0.05) {
    throw new Error('Bu sürüş kaydedilemeyecek kadar kısa. Biraz daha yol al.');
  }

  const client = requireSupabase();
  const route = downsampleRoute(session.route).map((point) => ({
    latitude: Number(point.latitude.toFixed(6)),
    longitude: Number(point.longitude.toFixed(6)),
  }));

  const vehicle = session.vehicle;
  const liters = vehicle ? fuelLiters(session.totalDistanceKm, vehicle.lPer100km) : 0;
  const cost = vehicle ? fuelCostTry(liters, vehicle.priceTry) : 0;
  const base = {
    user_id: userId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    total_distance_km: Number(session.totalDistanceKm.toFixed(3)),
    max_speed_kmh: Number(session.maxSpeedKmh.toFixed(1)),
    average_speed_kmh: Number(session.averageSpeedKmh.toFixed(1)),
    duration_seconds: session.durationSeconds,
    route,
  };
  const withFuel = vehicle
    ? {
        ...base,
        vehicle_id: vehicle.id,
        vehicle_label: vehicle.label,
        vehicle_image_url: vehicle.imageUrl ?? null,
        fuel_liters: Number(liters.toFixed(3)),
        fuel_cost_try: Number(cost.toFixed(2)),
        fuel_l_per_100km: Number(vehicle.lPer100km.toFixed(2)),
      }
    : base;

  let inserted = await client.from('drive_logs').insert(withFuel).select('id').single();
  if (inserted.error && vehicle && /column|schema cache/i.test(inserted.error.message)) {
    inserted = await client.from('drive_logs').insert(base).select('id').single();
  }
  if (inserted.error) throw new Error(mapAuthError(inserted.error));
  const driveId = String(inserted.data.id);

  if (vehicle && cost > 0) {
    const expense = await client.from('vehicle_expenses').insert({
      user_id: userId,
      vehicle_id: vehicle.id,
      drive_log_id: driveId,
      kind: 'yakit',
      title: 'Yakıt',
      amount_try: Number(cost.toFixed(2)),
      liters: Number(liters.toFixed(3)),
      distance_km: Number(session.totalDistanceKm.toFixed(3)),
      note: `${vehicle.label} · ${vehicle.lPer100km.toFixed(1)} L/100 km`,
      spent_at: session.endedAt,
    });
    // Masraf tablosu yoksa sürüş kaydı yine geçerlidir.
    void expense.error;
  }

  return driveId;
}

export async function deleteDriveLog(logId: string, userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('drive_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId);
  if (error) throw new Error(mapAuthError(error));
}
