import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TOKEN = process.env.VOICE_TOKEN || "rod-voice-token";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token || token !== ALLOWED_TOKEN) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
