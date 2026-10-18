"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveRoomCredentials } from "@/lib/device/session";
import type { JoinResult } from "@/lib/rooms/types";

/**
 * One click into a full match against 3 computer opponents, played with
 * the quick-mode token count — lets anyone exercise rolls, moves,
 * captures and a win without filling out a form or waiting for a long
 * match to finish.
 */
export function QuickTestButton() {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function start() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Tester",
          localPlayerCount: 1,
          roomSize: 4,
          botCount: 3,
          quickMode: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not start a test match.");
        return;
      }
      const result = data as JoinResult;
      saveRoomCredentials(result.room.roomId, {
        deviceGroupId: result.deviceGroupId,
        seats: result.credentials,
      });
      router.push(`/room/${result.room.roomId}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={start} disabled={submitting} className="text-muted-foreground">
      {submitting ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
      Quick test vs computer
    </Button>
  );
}
