"use client";

import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLAYER_COLOR_STYLES } from "@/lib/ui/playerColors";
import type { PlayerColor } from "@/lib/game/types";

export function GameOverDialog({
  open,
  winnerName,
  winnerColor,
  isMyWin,
  onOpenChange,
}: {
  open: boolean;
  winnerName: string | null;
  winnerColor: PlayerColor | null;
  isMyWin: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const style = winnerColor ? PLAYER_COLOR_STYLES[winnerColor] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <PartyPopper className="size-10 text-amber-500" />
          <DialogTitle className="text-xl">
            {isMyWin ? "You won!" : `${winnerName ?? "A player"} won!`}
          </DialogTitle>
          <DialogDescription>
            {style && (
              <span className={`inline-flex items-center gap-1.5 font-medium ${style.text}`}>
                <span className={`size-2.5 rounded-full ${style.bg}`} />
                {style.label}
              </span>
            )}{" "}
            got all four tokens home first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => router.push("/")}>Back to home</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
