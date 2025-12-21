// src/services/spaceApi.ts

const AUTH_BASE_URL =
  "https://dexraflow-auth-backend-c3hbhvcffbg6fbdh.canadacentral-01.azurewebsites.net";

export const spaceApi = {
  // -----------------------------
  // GET ALL SPACES (GET /spaces/)
  // -----------------------------
  async getSpaces(token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load spaces");

    return data.spaces;
  },

  // -----------------------------
  // CREATE SPACE (POST /spaces/create)
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

    return data.space;
  },

  // -----------------------------
  // DELETE SPACE
  // -----------------------------
  async deleteSpace(space_id: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/${space_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to delete space");

    return data;
  },

  // -----------------------------
  // GET SPACE DETAILS
  // -----------------------------
  async getSpaceDetails(space_id: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/${space_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load space details");

    return data.space;
  },

  // -----------------------------
  // UPDATE SPACE NAME
  // -----------------------------
  async updateSpace(space_id: string, name: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/${space_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to update space");

    return data.space;
  },

  // -----------------------------
  // INVITE MEMBER
  // -----------------------------
  async inviteMember(space_id: string, email: string, role: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ space_id, email, role }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to invite user");

    return data.invitation;
  },

  // -----------------------------
  // GET USER'S PENDING INVITATIONS
  // -----------------------------
  async getPendingInvitations(token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/invitations/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to load invitations");

    return data.invitations;
  },

  // -----------------------------
  // ACCEPT INVITATION
  // -----------------------------
  async acceptInvitation(inviteToken: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/accept-invitation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token: inviteToken }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Could not accept invitation");

    return data.space;
  },

  // -----------------------------
  // REMOVE MEMBER
  // -----------------------------
  async removeMember(space_id: string, user_id: string, token: string) {
    const res = await fetch(
      `${AUTH_BASE_URL}/spaces/${space_id}/members/${user_id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to remove member");

    return data;
  },

  // -----------------------------
  // UPDATE MEMBER ROLE
  // -----------------------------
  async updateMemberRole(space_id: string, user_id: string, role: string, token: string) {
    const res = await fetch(
      `${AUTH_BASE_URL}/spaces/${space_id}/members/${user_id}/role?role=${role}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to update role");

    return data;
  },

  // -----------------------------
  // LEAVE SPACE
  // -----------------------------
  async leaveSpace(space_id: string, token: string) {
    const res = await fetch(`${AUTH_BASE_URL}/spaces/${space_id}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to leave space");

    return data;
  },
};
