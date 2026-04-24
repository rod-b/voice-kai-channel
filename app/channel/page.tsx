"use client";

import { useEffect, useState } from "react";
import VoiceUI from "@/components/VoiceUI";

export default function ChannelPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--color-bg)" }}>
        <span style={{ color: "var(--color-primary)", fontSize: 32 }}>🐅</span>
      </div>
    );
  }

  return <VoiceUI />;
}
