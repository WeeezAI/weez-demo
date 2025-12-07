import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
}

interface Space {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  currentSpace: Space | null;
  spaces: Space[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  selectSpace: (space: Space) => void;
  exitSpace: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const demoSpaces: Space[] = [
  { id: "1", name: "Dexra Client Space", description: "Marketing campaigns and brand assets", color: "hsl(var(--primary))" },
  { id: "2", name: "Summer Campaign 2024", description: "Seasonal marketing initiatives", color: "hsl(262, 83%, 58%)" },
  { id: "3", name: "Product Launch", description: "New product marketing materials", color: "hsl(142, 71%, 45%)" },
  { id: "4", name: "Social Media Strategy", description: "Content calendar and analytics", color: "hsl(38, 92%, 50%)" },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentSpace, setCurrentSpace] = useState<Space | null>(null);
  const [spaces] = useState<Space[]>(demoSpaces);

  useEffect(() => {
    // Check for existing session in localStorage
    const storedUser = localStorage.getItem("weez_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Demo validation
    if (!email || !password) {
      return { success: false, error: "Please enter both email and password" };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }

    // Create demo user
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split("@")[0],
    };

    setUser(newUser);
    localStorage.setItem("weez_user", JSON.stringify(newUser));
    return { success: true };
  };

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Demo validation
    if (!name || !email || !password) {
      return { success: false, error: "Please fill in all fields" };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }

    if (!email.includes("@")) {
      return { success: false, error: "Please enter a valid email address" };
    }

    // Create demo user
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
    };

    setUser(newUser);
    localStorage.setItem("weez_user", JSON.stringify(newUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setCurrentSpace(null);
    localStorage.removeItem("weez_user");
  };

  const selectSpace = (space: Space) => {
    setCurrentSpace(space);
  };

  const exitSpace = () => {
    setCurrentSpace(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        currentSpace,
        spaces,
        login,
        register,
        logout,
        selectSpace,
        exitSpace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
