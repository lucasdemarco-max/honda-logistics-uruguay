import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, OperatorPermission } from "./labels";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextValue {
  user: User | null;
  ready: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, ready: false });

/** Single auth listener for the whole app (mounted in __root). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser((prev) => {
        const next = session?.user ?? null;
        return prev?.id === next?.id && event === "TOKEN_REFRESHED" ? prev : next;
      });
      setReady(true);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return <AuthContext.Provider value={{ user, ready }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export interface Access {
  roles: AppRole[];
  permissions: OperatorPermission[];
  profile: Profile | null;
  isAdmin: boolean;
  isStaff: boolean;
}

export function can(access: Access | undefined, perm: OperatorPermission): boolean {
  if (!access) return false;
  if (access.isAdmin) return true;
  return access.roles.includes("operador") && access.permissions.includes(perm);
}

/** UI-only convenience. Real authorization is enforced by database policies. */
export function useAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["access", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Access> => {
      const uid = user!.id;
      const [roles, perms, profile] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("operator_permissions").select("permission").eq("user_id", uid),
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      ]);
      const r = (roles.data ?? []).map((x) => x.role);
      return {
        roles: r,
        permissions: (perms.data ?? []).map((x) => x.permission),
        profile: profile.data ?? null,
        isAdmin: r.includes("admin"),
        isStaff: r.includes("admin") || r.includes("operador"),
      };
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  };
}
