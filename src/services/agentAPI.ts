// services/agentAPI.ts
// Service layer for Weez MCP Agent communication

const AGENT_BASE_URL =
  "https://dexraflow-asset-agent-ddfcf7d0fgg9ezc8.canadacentral-01.azurewebsites.net"; // Replace with actual base URL of the Agent API

export interface ChatMessage {
  user_id: string;
  space_id: string;
  query: string;
  conversation_id?: string;
  query_embedding?: number[];
  client_meta?: Record<string, any>;
}

export interface StreamChunk {
  // Format 1: event-based (your backend)
  content?: string;
  message?: string;
  done?: boolean;
  conversation_id?: string;
  
  // Format 2: type-based (legacy)
  type?: "token" | "error" | "done";
  error?: string;
}

export interface ChatResponse {
  assistant: string;
  conversation_id?: string;
}

/**
 * Stream chat responses using Server-Sent Events (SSE)
 */
export async function streamChat(
  message: ChatMessage,
  onToken: (token: string) => void,
  onError: (error: string) => void,
  onDone: (conversationId?: string) => void
): Promise<void> {
  console.log("🌐 Starting stream to:", `${AGENT_BASE_URL}/chat/stream`);
  console.log("📤 Payload:", message);

  let capturedConversationId: string | undefined;

  try {
    const response = await fetch(`${AGENT_BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    console.log("📡 Response status:", response.status);
    console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ HTTP Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log(`✅ Stream ended naturally after ${chunkCount} chunks`);
        onDone(capturedConversationId);
        break;
      }

      chunkCount++;
      const decodedChunk = decoder.decode(value, { stream: true });
      console.log(`📦 Chunk #${chunkCount}:`, decodedChunk);
      
      buffer += decodedChunk;

      // Process complete SSE messages (separated by double newlines)
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || ""; // Keep incomplete message in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        console.log("📄 Processing line:", line);

        // Parse SSE format - supports both event + data format
        // Format: "event: token\ndata: {...}"
        const eventMatch = line.match(/^event: (.+)$/m);
        const dataMatch = line.match(/^data: (.+)$/m);

        if (!dataMatch) {
          console.warn("⚠️ Line doesn't match SSE format:", line);
          continue;
        }

        try {
          const eventType = eventMatch ? eventMatch[1] : null;
          const data = JSON.parse(dataMatch[1]);
          
          console.log("✨ Parsed SSE - Event:", eventType, "Data:", data);

          // Capture conversation_id if present in any event
          if (data.conversation_id) {
            capturedConversationId = data.conversation_id;
          }

          // Handle based on event type
          if (eventType === "token" && data.content) {
            // Send content directly without filtering
            onToken(data.content);
          } else if (eventType === "error") {
            console.error("❌ Error in stream:", data.message || data.error);
            onError(data.message || data.error || "Unknown error occurred");
          } else if (eventType === "done") {
            console.log("✅ Received done signal");
            onDone(capturedConversationId);
            return;
          }
          // Fallback for data without event type (legacy format)
          else if (data.type === "token" && data.content) {
            // Send content directly without filtering
            onToken(data.content);
          } else if (data.type === "error") {
            onError(data.error || "Unknown error occurred");
          } else if (data.type === "done") {
            onDone(capturedConversationId);
            return;
          }
        } catch (parseErr) {
          console.error("❌ Failed to parse SSE data:", parseErr, "Raw:", dataMatch[1]);
        }
      }
    }
  } catch (err) {
    console.error("❌ Stream error:", err);
    const errorMessage = err instanceof Error ? err.message : "Stream connection failed";
    onError(errorMessage);
  }
}

/**
 * Non-streaming chat endpoint (fallback)
 */
export async function chatNonStream(
  message: ChatMessage
): Promise<ChatResponse> {
  try {
    const response = await fetch(`${AGENT_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    
    // Return data as-is without filtering
    return data;
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to connect to agent"
    );
  }
}

/**
 * Health check endpoint
 */
export async function checkHealth(): Promise<{
  status: string;
  service: string;
}> {
  const response = await fetch(`${AGENT_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return await response.json();
}