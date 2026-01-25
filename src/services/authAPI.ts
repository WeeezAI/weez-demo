// src/services/authApi.ts
const AUTH_BASE_URL = "http://localhost:8002";

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
  // LOGIN (FastAPI expects x-www-form-urlencoded as per OAuth2PasswordRequestForm)
  // -----------------------------
  async login(payload: LoginPayload) {
    const form = new URLSearchParams();
    form.append("username", payload.email); // Substituted for 'username'
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

    return data; // { access_token, token_type, user: { user_id, email, first_name, last_name } }
  },

  // -----------------------------
  // REGISTER (Backend expects first_name, last_name, email, password)
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

    return data; // { message: "Verification email sent..." }
  },

  // -----------------------------
  // VERIFY EMAIL
  // -----------------------------
  async verifyEmail(token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Email verification failed");

    return data;
  }
};
