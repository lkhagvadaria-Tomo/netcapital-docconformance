import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { AppUser } from "@/types/database.types";
import { MOCK_USERS } from "@/lib/auth/mockAuth";

interface AuthState {
  /** null while resolving; undefined-like "no session" is represented by user=null after resolution */
  loading: boolean;
  profile: AppUser | null;
  /** true when running against a mocked, manual-user-picker session (never true in production — spec §2/§10) */
  isMock: boolean;
  signInWithGoogle: () => Promise<void>;
  signInMock: (userId: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE as string | undefined;
// Mock mode is only permitted when Supabase itself isn't configured, or the
// env explicitly opts in — it must never silently activate against a real
// project (that would let anyone impersonate any unit).
const MOCK_ALLOWED = AUTH_MODE === "mock" || !isSupabaseConfigured;

const MOCK_SESSION_KEY = "docconformance_mock_user_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [mockUserId, setMockUserId] = useState<string | null>(() =>
    MOCK_ALLOWED ? sessionStorage.getItem(MOCK_SESSION_KEY) : null
  );

  const loadProfile = useCallback(async () => {
    if (mockUserId) {
      const found = MOCK_USERS.find((u) => u.id === mockUserId) ?? null;
      setProfile(found);
      setLoading(false);
      return;
    }
    if (!supabase) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData.session?.user;
    if (!authUser) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (error) {
      console.error("Failed to load profile", error);
    }
    setProfile(data ?? null);
    setLoading(false);
  }, [mockUserId]);

  useEffect(() => {
    loadProfile();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error(
        "Supabase тохируулагдаагүй байна — энэ орчинд зөвхөн Хөгжүүлэлтийн горим (mock) ажиллана."
      );
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // hosted-domain restriction is enforced server-side too (users.email
        // check constraint + RLS), this is just the friendlier UX gate.
        queryParams: { hd: "netgroup.mn" },
        redirectTo: window.location.origin,
      },
    });
  }, []);

  const signInMock = useCallback((userId: string) => {
    sessionStorage.setItem(MOCK_SESSION_KEY, userId);
    setMockUserId(userId);
  }, []);

  const signOut = useCallback(async () => {
    if (mockUserId) {
      sessionStorage.removeItem(MOCK_SESSION_KEY);
      setMockUserId(null);
      setProfile(null);
      return;
    }
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
  }, [mockUserId]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      profile,
      isMock: mockUserId !== null,
      signInWithGoogle,
      signInMock,
      signOut,
    }),
    [loading, profile, mockUserId, signInWithGoogle, signInMock, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { MOCK_ALLOWED };
