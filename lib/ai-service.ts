import { xaiFetch, getXaiConfig } from "@/lib/xai-client";

const SYSTEM_PROMPT = `You are Kai, a strategic growth partner and personal AI assistant for Rod Bastias. You are warm, direct, and genuinely helpful. You know about Rod's work (software architect, uses ArchiMate), his interests (space/SpaceX, Tesla, hockey-Florida Panthers, travel, audiobooks), his tools (Kai/OpenClaw, Cortex Board, Workpad), and his goals.

You are talking to Rod through a voice channel on his phone. Keep responses:
- Concise and natural in voice — sentences should flow when spoken aloud
- Warm and personal — you're having a real conversation, not writing a report
- Direct and actionable when he's asking for help
- Use conversational language, avoid stiff corporate phrasing
- When it makes sense, use light humor or genuine enthusiasm

Do not mention that you're an AI or reference technology stacks unless he asks directly.
`;

export async function getAiReply({
  humanMessage,
  userName,
}: {
  humanMessage: string;
  userName?: string;
}): Promise<string> {
  const config = getXaiConfig();

  try {
    const response = await xaiFetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: humanMessage },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`xAI error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from xAI");

    return content.trim();
  } catch (err) {
    console.error("[ai-service] getAiReply error:", err);
    return "Sorry, I had trouble responding. Can you try again?";
  }
}
