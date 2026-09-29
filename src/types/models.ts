export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  title: string | null;
  is_pro: boolean;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  like_count: number;
  vehicle_count: number;
  badge_count: number;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
};

export type Club = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  location: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_verified: boolean;
  member_count: number;
  tags: string[];
  recent_activity: string | null;
  created_by?: string | null;
};

export type ClubPost = {
  id: string;
  club_id: string;
  author_id: string;
  body: string;
  image_url: string | null;
  hashtags: string[];
  like_count: number;
  reply_count?: number;
  created_at: string;
  author?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
  liked_by_me?: boolean;
};

export type ClubPostReply = {
  id: string;
  post_id: string;
  club_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
};

export type Track = {
  id: string;
  name: string;
  location: string | null;
  length_km: number | null;
  map_image_url: string | null;
  route_label: string | null;
};

export type EventItem = {
  id: string;
  club_id: string | null;
  track_id: string | null;
  title: string;
  subtitle: string | null;
  event_type: 'convoy' | 'track_day' | 'meetup' | 'dyno' | 'other';
  start_time: string;
  location_name: string | null;
  banner_url: string | null;
  is_live: boolean;
  is_featured: boolean;
  approved_vehicle_count: number;
  participant_count: number;
  club?: Club | null;
  track?: Track | null;
};

export type Vehicle = {
  id: string;
  owner_id: string;
  make: string;
  model: string;
  year: number | null;
  body_type: string | null;
  engine_code: string | null;
  vehicle_type: 'car' | 'motorcycle';
  hp: number | null;
  torque_nm: number | null;
  weight_kg: number | null;
  zero_to_hundred: number | null;
  image_url: string | null;
  garage_number: number | null;
  ecu_map: string | null;
  exhaust_db: number | null;
  last_dyno_at: string | null;
  is_active: boolean;
  fuel_l_per_100km?: number | null;
  fuel_price_try?: number | null;
  badges: string[];
  mods?: string[];
  arena_score?: number;
  arena_likes?: number;
  arena_passes?: number;
  owner?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
};

export type Badge = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  description: string | null;
  icon_url?: string | null;
  achievement_value?: string | null;
};

export type Shot = {
  id: string;
  creator_id: string;
  vehicle_id: string | null;
  club_id: string | null;
  caption: string | null;
  hashtags: string[];
  video_url: string;
  thumbnail_url: string | null;
  audio_title: string | null;
  audio_source?: 'original' | 'soundbank' | null;
  destination?: 'club' | 'explore' | 'both';
  category_tag: string | null;
  speed_max: number | null;
  boost_bar: number | null;
  rpm_max: number | null;
  zero_to_hundred: number | null;
  dyno_whp: number | null;
  exhaust_db: number | null;
  ecu_map: string | null;
  telemetry_enabled?: boolean;
  like_count: number;
  comment_count: number;
  bookmark_count: number;
  share_count: number;
  view_count: number;
  published_at?: string | null;
  creator?: Profile | null;
  vehicle?: Vehicle | null;
  club?: Club | null;
};

export type DriveRoutePoint = {
  latitude: number;
  longitude: number;
};

export type DriveLog = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  total_distance_km: number;
  max_speed_kmh: number;
  average_speed_kmh: number;
  duration_seconds: number;
  route: DriveRoutePoint[];
  created_at: string;
  vehicle_id?: string | null;
  vehicle_label?: string | null;
  vehicle_image_url?: string | null;
  fuel_liters?: number | null;
  fuel_cost_try?: number | null;
  fuel_l_per_100km?: number | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: 'like' | 'follow' | 'club_join' | 'club_reply' | string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  actor?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'full_name'> | null;
};
