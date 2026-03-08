import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  getCurrentUser,
  loginUser as loginUserRequest,
  logoutUser as logoutUserRequest,
  type LoginPayload
} from "../services/api";
import type { AuthUser } from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  loginUser: (payload: LoginPayload) => Promise<AuthUser>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { user: currentUser } = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const loginUser = useCallback(async (payload: LoginPayload) => {
    const { user: loggedInUser } = await loginUserRequest(payload);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logoutUser = useCallback(async () => {
    await logoutUserRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      loginUser,
      logoutUser,
      refreshUser,
      setUser
    }),
    [isLoading, loginUser, logoutUser, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
