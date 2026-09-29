import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { mapAuthError } from '../lib/authErrors';
import { removePushTokenLocal } from '../lib/pushNotifications';
import { normalizeUsername } from '../lib/validation';
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase';
import type { Profile } from '../types/models';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    username: string;
  }) => Promise<{ needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_SELECT =
  'id, username, full_name, avatar_url, bio, title, is_pro, is_verified, follower_count, following_count, like_count, vehicle_count, badge_count';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

/** Trigger kaçırırsa veya yarış olursa profili garantiye alır */
async function ensureProfile(
  user: User,
  meta?: { username?: string; fullName?: string },
): Promise<Profile> {
  const client = requireSupabase();

  // Trigger biraz gecikebilir — kısa retry
  for (let i = 0; i < 4; i++) {
    const existing = await fetchProfile(user.id);
    if (existing) {
      if (meta?.fullName && !existing.full_name) {
        const { data } = await client
          .from('profiles')
          .update({ full_name: meta.fullName })
          .eq('id', user.id)
          .select(PROFILE_SELECT)
          .single();
        if (data) return data as Profile;
      }
      return existing;
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }

  const username =
    normalizeUsername(
      meta?.username ||
        (user.user_metadata?.username as string) ||
        `pilot_${user.id.replace(/-/g, '').slice(0, 8)}`,
    ) || `pilot_${user.id.replace(/-/g, '').slice(0, 8)}`;

  const fullName =
    meta?.fullName || (user.user_metadata?.full_name as string) || null;

  const { data, error } = await client
    .from('profiles')
    .upsert(
      { id: user.id, username, full_name: fullName },
      { onConflict: 'id' },
    )
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      const fallback = `pilot_${user.id.replace(/-/g, '').slice(0, 10)}`;
      const retry = await client
        .from('profiles')
        .upsert(
          { id: user.id, username: fallback, full_name: fullName },
          { onConflict: 'id' },
        )
        .select(PROFILE_SELECT)
        .single();
      if (retry.error) throw retry.error;
      return retry.data as Profile;
    }
    throw error;
  }

  return data as Profile;
}

async function assertUsernameAvailable(username: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('is_username_available', {
    u: username,
  });

  if (error) {
    const check = await client
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (check.error) throw check.error;
    if (check.data) throw new Error('Bu kullanıcı adı alınmış');
    return;
  }

  if (data === false) throw new Error('Bu kullanıcı adı alınmış');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileReq = useRef(0);

  const loadProfileFor = useCallback(async (user: User | null) => {
    const req = ++profileReq.current;
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const p = await ensureProfile(user);
      if (req === profileReq.current) setProfile(p);
    } catch {
      if (req === profileReq.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setSession(data.session);
        await loadProfileFor(data.session?.user ?? null);
      } catch {
        if (mounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void boot();

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    // onAuthStateChange içinde await YAPMA (deadlock riski)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setTimeout(() => {
        void loadProfileFor(next?.user ?? null);
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileFor]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(mapAuthError(error));
    if (!data.session) {
      throw new Error('Oturum açılamadı. E-posta doğrulamasını kontrol et.');
    }
    setSession(data.session);
    await loadProfileFor(data.session.user);
  }, [loadProfileFor]);

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      username: string;
    }) => {
      const client = requireSupabase();
      const username = normalizeUsername(input.username);
      const fullName = input.fullName.trim();
      const email = input.email.trim().toLowerCase();

      await assertUsernameAvailable(username);

      const { data, error } = await client.auth.signUp({
        email,
        password: input.password,
        options: {
          data: {
            username,
            full_name: fullName,
          },
        },
      });

      if (error) throw new Error(mapAuthError(error));

      if (!data.session || !data.user) {
        return { needsEmailConfirm: true };
      }

      try {
        const p = await ensureProfile(data.user, { username, fullName });
        setSession(data.session);
        setProfile(p);
      } catch (e) {
        throw new Error(mapAuthError(e));
      }

      return { needsEmailConfirm: false };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const client = requireSupabase();
    try {
      await removePushTokenLocal();
    } catch {
      // token silinemese de çıkışa devam
    }
    const { error } = await client.auth.signOut();
    if (error) throw new Error(mapAuthError(error));
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth only inside AuthProvider');
  return ctx;
}
