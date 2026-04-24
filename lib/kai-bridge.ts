import { getAiReply as _getAiReply } from "@/lib/ai-service";

export async function getAiReply(request: {
  humanMessage: string;
  userName?: string;
  continuitySummaries?: unknown[];
}): Promise<string> {
  return _getAiReply({
    humanMessage: request.humanMessage,
    userName: request.userName,
  });
}
