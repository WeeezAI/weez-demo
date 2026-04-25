import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

import { authApi } from "@/services/authAPI";
import { spaceApi } from "@/services/spaceAPI";

interface User {
  id: string;
  email: string;
  name: string;
  plan_type: string;
}

interface Space {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loadingAuth: boolean;

  currentSpace: Space | null;
  spaces: Space[];
  token: string | null;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  selectSpace: (space: Space) => void;
  exitSpace: () => void;

  createSpace: (name: string) => Promise<{ success: boolean; error?: string }>;
  deleteSpace: (space_id: string) => Promise<{ success: boolean; error?: string }>;
  renameSpace: (space_id: string, name: string) => Promise<{ success: boolean; error?: string }>;
  refreshSpaces: () => Promise<void>; // Manual refresh function
  isFetchingSpaces: boolean;
  selectedSpace: Space | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache key and expiry time (5 minutes)
const SPACES_CACHE_KEY = "weez_spaces_cache";
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(() => {
    const saved = sessionStorage.getItem("weez_current_space");
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState<string | null>(
    sessionStorage.getItem("token")
  );

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isFetchingSpaces, setIsFetchingSpaces] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  // Load cached spaces from sessionStorage
  const loadCachedSpaces = () => {
    try {
      const cached = sessionStorage.getItem(SPACES_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - timestamp < CACHE_EXPIRY_MS) {
          setSpaces(data || []);
          setLastFetchTime(timestamp);
          return true;
        }
      }
    } catch (err) {
      console.error("Failed to load cached spaces", err);
    }
    return false;
  };

  // Save spaces to cache
  const cacheSpaces = (spacesData: Space[]) => {
    try {
      const cacheData = {
        data: spacesData,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(SPACES_CACHE_KEY, JSON.stringify(cacheData));
      setLastFetchTime(Date.now());
    } catch (err) {
      console.error("Failed to cache spaces", err);
    }
  };

  // Fetch spaces from API
  const fetchSpaces = async (forceRefresh = false) => {
    if (!token) return;

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;

    // Skip fetch if cache is still valid and not forcing refresh
    if (!forceRefresh && timeSinceLastFetch < CACHE_EXPIRY_MS && spaces.length > 0) {
      return;
    }

    setIsFetchingSpaces(true);
    try {
      const data = await spaceApi.getSpaces(token);
      setSpaces(data || []);
      cacheSpaces(data || []);
    } catch (err) {
      console.error("Failed to load spaces", err);
      // If API fails, try to use cached data
      loadCachedSpaces();
    } finally {
      setIsFetchingSpaces(false);
    }
  };

  // Manual refresh function exposed to components
  const refreshSpaces = async () => {
    await fetchSpaces(true);
  };

  // LOGIN
  const login = async (email: string, password: string) => {
    try {
      const data = await authApi.login({ email, password });

      const mappedUser = {
        id: data.user.user_id,
        email: data.user.email,
        name: `${data.user.first_name} ${data.user.last_name}`,
        plan_type: data.user.plan_type,
      };

      sessionStorage.setItem("token", data.access_token);
      setToken(data.access_token);

      sessionStorage.setItem("weez_user", JSON.stringify(mappedUser));
      setUser(mappedUser);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Login failed" };
    }
  };

  // REGISTER
  const register = async (name: string, email: string, password: string) => {
    try {
      await authApi.register({ name, email, password });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // LOGOUT
  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("weez_user");
    sessionStorage.removeItem("weez_current_space");
    sessionStorage.removeItem(SPACES_CACHE_KEY);
    setToken(null);
    setUser(null);
    setSpaces([]);
    setCurrentSpace(null);
    setLastFetchTime(0);
  };

  // Select space
  const selectSpace = (space: Space) => {
    setCurrentSpace(space);
    sessionStorage.setItem("weez_current_space", JSON.stringify(space));
  };

  const exitSpace = () => {
    setCurrentSpace(null);
    sessionStorage.removeItem("weez_current_space");
  };

  // CREATE SPACE
  const createSpace = async (name: string) => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      await spaceApi.createSpace(name, token);
      await fetchSpaces(true); // Force refresh after creating
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // DELETE SPACE
  const deleteSpace = async (space_id: string) => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      await spaceApi.deleteSpace(space_id, token);
      await fetchSpaces(true); // Force refresh after deleting
      if (currentSpace?.id === space_id) {
        setCurrentSpace(null);
        sessionStorage.removeItem("weez_current_space");
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // RENAME SPACE
  const renameSpace = async (space_id: string, name: string) => {
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      await spaceApi.updateSpace(space_id, name, token);
      await fetchSpaces(true); // Force refresh after renaming

      // Update current space if it's the one being renamed
      if (currentSpace?.id === space_id) {
        const updatedSpace = { ...currentSpace, name };
        setCurrentSpace(updatedSpace);
        sessionStorage.setItem("weez_current_space", JSON.stringify(updatedSpace));
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // LOAD USER ONCE
  useEffect(() => {
    const storedUser = sessionStorage.getItem("weez_user");

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      // Load cached spaces immediately
      loadCachedSpaces();
    }

    setLoadingAuth(false);
  }, []);

  // FETCH SPACES WHEN TOKEN CHANGES (respects cache)
  useEffect(() => {
    if (token) {
      fetchSpaces();
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loadingAuth,

        spaces,
        currentSpace,
        token,

        login,
        register,
        logout,

        selectSpace,
        exitSpace,

        createSpace,
        deleteSpace,
        renameSpace,
        refreshSpaces,
        isFetchingSpaces,
        selectedSpace: currentSpace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};