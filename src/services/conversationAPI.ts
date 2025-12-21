// services/conversationAPI.ts

const AGENT_BASE_URL = "https://dexraflow-asset-agent-ddfcf7d0fgg9ezc8.canadacentral-01.azurewebsites.net"; // Replace with actual base URL of the Agent API

export interface Conversation {
  conversation_id: string;
  preview: string;
  last_updated: string;
  message_count: number;
}

export interface ConversationTurn {
  id: string;
  conversation_id: string;
  space_id: string;
  user_id: string;
  user_query: string;
  agent_response: string;
  timestamp: string;
  metadata?: any;
}

/**
 * Fetch all conversations for a user in a space
 */
export async function fetchConversations(
  spaceId: string,
  userId: string
): Promise<Conversation[]> {
  try {
    const url = `${AGENT_BASE_URL}/api/conversations?space_id=${encodeURIComponent(spaceId)}&user_id=${encodeURIComponent(userId)}`;
    console.log("🔍 Fetching conversations from:", url);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Error response:", text);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.conversations || [];
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    throw error;
  }
}

/**
 * Fetch a single conversation's full history (all turns)
 * Each turn contains both user_query and agent_response
 */
export async function fetchConversationHistory(
  conversationId: string,
  spaceId: string,
  userId: string
): Promise<ConversationTurn[]> {
  try {
    const url = `${AGENT_BASE_URL}/api/conversation/${encodeURIComponent(conversationId)}?space_id=${encodeURIComponent(spaceId)}&user_id=${encodeURIComponent(userId)}`;
    console.log("🔍 Fetching conversation history from:", url);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Error response:", text);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Returns array of turns (not individual messages)
    // Each turn has: user_query, agent_response, timestamp, etc.
    return data.messages || [];
  } catch (error) {
    console.error("Failed to fetch conversation history:", error);
    throw error;
  }
}