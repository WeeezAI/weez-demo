// src/services/authApi.ts
const AUTH_BASE_URL =
  "https://dexraflow-auth-api-dsaafqdxamgma9hx.canadacentral-01.azurewebsites.net";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export const authApi = {
  // -----------------------------
  // LOGIN  (backend expects x-www-form-urlencoded)
  // -----------------------------
  async login(payload: LoginPayload) {
    const form = new URLSearchParams();
    form.append("username", payload.email);
    form.append("password", payload.password);

    const res = await fetch(`${AUTH_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Invalid email or password");
    }

    return data; // { access_token, user }
  },

  // -----------------------------
  // REGISTER  (backend expects first_name, last_name)
  // -----------------------------
  async register(payload: RegisterPayload) {
    const [first_name, ...rest] = payload.name.split(" ");
    const last_name = rest.join(" ") || "";

    const res = await fetch(`${AUTH_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name,
        last_name,
        email: payload.email,
        password: payload.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Registration failed");

    return data;
  },

  // -----------------------------
  // GET ALL SPACES  
  // (backend route: GET /spaces/)
  // -----------------------------
  async getMySpaces(token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load spaces");

    return data; // { spaces: [...] }
  },

  // -----------------------------
  // CREATE SPACE  (backend: POST /spaces/create)
  // -----------------------------
  async createSpace(name: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to create space");

    return data;
  },
};
