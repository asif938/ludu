"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlayerPanel } from "./PlayerPanel";
import { LeaveMatchButton } from "./LeaveMatchButton";
import type { GameState } from "@/lib/game/types";
import type { RoomUpdatedPayload } from "@/lib/socket/events";

/**
 * Small-screen-only: a fixed bottom bar with a single "Menu" button,
 * replacing the always-visible side panel the lg+ layout shows inline.
 * Keeps the player list and leave action reachable without permanently
 * taking up board space or forcing the page to scroll.
 */
export function MobileMatchMenu({
  room,
  gameState,
  isHost,
  onRemovePlayer,
}: {
  room: RoomUpdatedPayload;
  gameState: GameState;
  isHost: boolean;
  onRemovePlayer: (seatIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 p-2 backdrop-blur-sm lg:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" className="h-11 w-full">
              <Menu className="size-4" />
              Menu
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Players</DialogTitle>
          </DialogHeader>
          <PlayerPanel
            room={room}
            gameState={gameState}
            isHost={isHost}
            onRemovePlayer={(seatIndex) => {
              onRemovePlayer(seatIndex);
              setOpen(false);
            }}
          />
          <LeaveMatchButton className="w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
