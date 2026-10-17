"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveRoomCredentials } from "@/lib/device/session";
import type { JoinResult, PublicRoom } from "@/lib/rooms/types";

type FetchState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; room: PublicRoom };

export function JoinForm({
  roomId,
  onJoined,
}: {
  roomId: string;
  onJoined: () => void;
}) {
  const [state, setState] = useState<FetchState>({ phase: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ phase: "error", message: data?.error?.message ?? "Room not found." });
          return;
        }
        setState({ phase: "ready", room: data.room as PublicRoom });
      } catch {
        if (!cancelled) {
          setState({
            phase: "error",
            message: "Couldn't reach the server. Check your connection and try again.",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error?.message ?? "Could not join this room.");
        return;
      }
      const result = data as JoinResult;
      saveRoomCredentials(roomId, {
        deviceGroupId: result.deviceGroupId,
        seats: result.credentials,
      });
      onJoined();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <CardTitle className="mt-2">Can&apos;t join this room</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { room } = state;
  if (!room.canJoin) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <AlertTriangle className="mx-auto size-8 text-amber-500" />
            <CardTitle className="mt-2">
              {room.status === "playing" ? "Match already started" : room.status === "finished" ? "Match has ended" : "Room is full"}
            </CardTitle>
            <CardDescription>
              {room.status === "waiting"
                ? "All 4 seats are taken. Ask the host for a different room."
                : "You can't join this room right now."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {room.occupiedCount} / 4 seats taken
          </div>
          <CardTitle>Join room {roomId}</CardTitle>
          <CardDescription>Enter a display name to join the match.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Your display name</Label>
              <Input
                id="displayName"
                placeholder="e.g. Jordan"
                autoComplete="off"
                maxLength={20}
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <Button type="submit" className="w-full" disabled={submitting || !displayName.trim()}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Join
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
