import { getAiReply as _getAiReply } from "@/lib/ai-service";

export async function getAiReply(request: {
  humanMessage: string;
  userName?: string;
  continuitySummaries?: unknown[];
  conversationHistory?: Array<{
    role: "human" | "ai";
    body: string;
    createdAt?: string;
  }>;
}): Promise<string> {
  return _getAiReply({
    humanMessage: request.humanMessage,
    userName: request.userName,
    conversationHistory: request.conversationHistory,
  });
}
