// src/services/platformAPI.ts

const BASE_URL =
  "https://dexraflow-platform-connection-hrd4akh9eqgeeqe9.canadacentral-01.azurewebsites.net";

export const platformAPI = {
  /** Get OAuth authorization URL */
  async getAuthUrl(spaceId: string, provider: string, token: string) {
    console.log(`🔗 Getting auth URL for ${provider} in space ${spaceId}`);
    
    const res = await fetch(
      `${BASE_URL}/platforms/${spaceId}/${provider}/connect`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ OAuth URL error:", res.status, errorText);
      throw new Error(`Failed to get auth URL: ${errorText}`);
    }

    const data = await res.json();
    console.log("✅ Auth URL received");
    return data; // { auth_url: "..." }
  },

  /** Save OAuth token (not used now — kept for compatibility) */
  async saveConnection(payload: any) {
    const res = await fetch(`${BASE_URL}/platforms/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Save connection error:", res.status, errorText);
      throw new Error(`Failed to save connection: ${errorText}`);
    }

    return res.json();
  },

  /** Fetch connected platforms for a space */
  async getConnections(spaceId: string, token: string) {
    console.log(`📋 Fetching connections for space ${spaceId}`);
    
    const res = await fetch(`${BASE_URL}/spaces/${spaceId}/connections`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(
        "❌ Failed to fetch connections:",
        res.status,
        errorText
      );
      return []; // Prevent UI crash
    }

    const data = await res.json();
    console.log(`✅ Found ${data.length} connection(s)`);
    return data; // [{ platform:"google", connected:true, ... }]
  },

  /** Fetch folders from Google Drive */
  async getFolders(spaceId: string, provider: string, token: string) {
    console.log(`📂 Fetching folders for ${provider} in space ${spaceId}`);
    
    try {
      const res = await fetch(
        `${BASE_URL}/platforms/${spaceId}/${provider}/folders`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Failed to fetch folders:", res.status, errorText);
        
        // Parse error detail if available
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.detail || "Failed to fetch folders");
        } catch {
          throw new Error(`Failed to fetch folders: ${errorText}`);
        }
      }

      const data = await res.json();
      console.log(`✅ Fetched ${data.folders?.length || 0} folders`);
      return data; // { folders: [...] }
    } catch (error) {
      console.error("❌ Error fetching folders:", error);
      throw error;
    }
  },

  /** Sync selected folders */
  async syncFolders(
    spaceId: string,
    provider: string,
    folders: any[],
    token: string
  ) {
    console.log(`🔄 Syncing ${folders.length} folders for ${provider}`);
    
    try {
      const res = await fetch(
        `${BASE_URL}/sync/${spaceId}/${provider}/folders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(folders),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Folder sync failed:", res.status, errorText);
        throw new Error(`Failed syncing folders: ${errorText}`);
      }

      const data = await res.json();
      console.log(`✅ Successfully synced folders`);
      return data;
    } catch (error) {
      console.error("❌ Error syncing folders:", error);
      throw error;
    }
  },

  /** Check platform connection status and token validity */
  async checkStatus(spaceId: string, provider: string, token: string) {
    console.log(`🔍 Checking status for ${provider} in space ${spaceId}`);
    
    try {
      const res = await fetch(
        `${BASE_URL}/platforms/${spaceId}/${provider}/status`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Status check failed:", res.status, errorText);
        return null;
      }

      const data = await res.json();
      console.log(`✅ Status:`, data);
      return data;
    } catch (error) {
      console.error("❌ Error checking status:", error);
      return null;
    }
  },

  /** Disconnect platform and revoke tokens */
  async disconnect(spaceId: string, provider: string, token: string) {
    console.log(`🔌 Disconnecting ${provider} from space ${spaceId}`);
    
    try {
      const res = await fetch(
        `${BASE_URL}/platforms/${spaceId}/${provider}/disconnect`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Disconnect failed:", res.status, errorText);
        throw new Error(`Failed to disconnect platform: ${errorText}`);
      }

      const data = await res.json();
      console.log(`✅ Successfully disconnected ${provider}`);
      return data;
    } catch (error) {
      console.error("❌ Error disconnecting:", error);
      throw error;
    }
  },
};