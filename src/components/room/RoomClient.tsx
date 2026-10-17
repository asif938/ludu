"use client";

import { useEffect, useState } from "react";
import { loadRoomCredentials } from "@/lib/device/session";
import { JoinForm } from "./JoinForm";
import { RoomStage } from "./RoomStage";

type Phase = "checking" | "join" | "ready";

export function RoomClient({ roomId }: { roomId: string }) {
  const [phase, setPhase] = useState<Phase>("checking");

  // localStorage only exists client-side, so this must run post-mount —
  // computing it during render would mismatch the server-rendered HTML.
  useEffect(() => {
    const creds = loadRoomCredentials(roomId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(creds && creds.seats.length > 0 ? "ready" : "join");
  }, [roomId]);

  if (phase === "checking") return null;
  if (phase === "join") {
    return <JoinForm roomId={roomId} onJoined={() => setPhase("ready")} />;
  }
  return <RoomStage roomId={roomId} />;
}
