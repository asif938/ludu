"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  LogOut,
  Share2,
  Smartphone,
  UserMinus,
  UserPlus,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PLAYER_COLOR_STYLES } from "@/lib/ui/playerColors";
import type { RoomUpdatedPayload } from "@/lib/socket/events";
import type { SeatConfigureMode } from "@/lib/rooms/types";

export function Lobby({
  room,
  mySeatIndexes,
  onStart,
  onLeave,
  onConfigureSeat,
}: {
  room: RoomUpdatedPayload;
  mySeatIndexes: number[];
  onStart: () => void;
  onLeave: () => void;
  onConfigureSeat: (targetSeatIndex: number, mode: SeatConfigureMode) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isHost = mySeatIndexes.includes(room.hostSeatIndex);
  const occupiedCount = room.seats.filter((s) => s.occupied).length;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/room/${room.roomId}` : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Ludo Connect game",
          text: "Join my Ludo match:",
          url: inviteUrl,
        });
      } catch {
        // user cancelled share — ignore
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Room {room.roomId}</span>
            <div className="flex items-center gap-1.5">
              {room.quickMode && <Badge variant="outline">Quick match</Badge>}
              <Badge variant="secondary">
                {occupiedCount} / {room.roomSize} players
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={copyLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copy invite link
          </Button>
          <Button variant="outline" className="flex-1" onClick={shareLink}>
            <Share2 className="size-4" />
            Share
          </Button>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {room.seats.map((seat) => {
            const style = PLAYER_COLOR_STYLES[seat.color];
            const seatLabel = seat.occupied
              ? seat.displayName
              : seat.closed
                ? `Seat ${seat.seatIndex + 1} — left empty`
                : `Seat ${seat.seatIndex + 1} — waiting for player`;
            return (
              <div
                key={seat.seatIndex}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className={`size-3 shrink-0 rounded-full ${seat.occupied ? style.bg : "bg-muted"}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {seatLabel}
                      {seat.isHost && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Host
                        </Badge>
                      )}
                    </p>
                    <p className={`text-xs ${style.text}`}>{style.label}</p>
                  </div>
                </div>
                {seat.occupied && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {seat.kind === "local" ? (
                        <Smartphone className="size-3.5" />
                      ) : seat.kind === "bot" ? (
                        <Bot className="size-3.5" />
                      ) : (
                        <Wifi className="size-3.5" />
                      )}
                      {seat.kind}
                    </span>
                    {seat.kind !== "bot" && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="flex items-center gap-1">
                          {seat.connected ? (
                            <Wifi className="size-3.5 text-emerald-500" />
                          ) : (
                            <WifiOff className="size-3.5 text-muted-foreground" />
                          )}
                          {seat.connected ? "Connected" : "Disconnected"}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {isHost && !seat.occupied && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onConfigureSeat(seat.seatIndex, "bot")}
                    >
                      <Bot className="size-3.5" />
                      Add bot
                    </Button>
                    {seat.closed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onConfigureSeat(seat.seatIndex, "waiting")}
                      >
                        <UserPlus className="size-3.5" />
                        Wait for player
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onConfigureSeat(seat.seatIndex, "empty")}
                      >
                        <UserMinus className="size-3.5" />
                        Leave empty
                      </Button>
                    )}
                  </div>
                )}
                {isHost && seat.occupied && seat.kind === "bot" && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onConfigureSeat(seat.seatIndex, "waiting")}
                    >
                      <UserMinus className="size-3.5" />
                      Remove bot
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onLeave}>
          <LogOut className="size-4" />
          Leave room
        </Button>
        {isHost && (
          <Button className="flex-1" disabled={occupiedCount < 2} onClick={onStart}>
            Start game
          </Button>
        )}
      </div>
      {isHost && occupiedCount < 2 && (
        <p className="text-center text-xs text-muted-foreground">
          Waiting for at least one more player before you can start.
        </p>
      )}
    </div>
  );
}
