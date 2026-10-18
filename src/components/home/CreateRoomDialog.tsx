"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { createRoomSchema, type CreateRoomInput } from "@/lib/validation/schemas";
import { saveRoomCredentials } from "@/lib/device/session";
import type { JoinResult } from "@/lib/rooms/types";

type Mode = "with-others" | "vs-computer";

export function CreateRoomDialog({
  children,
  defaultMode = "with-others",
}: {
  children: React.ReactNode;
  defaultMode?: Mode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const router = useRouter();

  const form = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      displayName: "",
      localPlayerCount: 1,
      roomSize: 4,
      botCount: 0,
      quickMode: false,
    },
  });

  const roomSize = form.watch("roomSize");
  const localPlayerCount = form.watch("localPlayerCount");
  const quickMode = form.watch("quickMode");
  const botOpponents = mode === "vs-computer" ? roomSize - 1 : 0;

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "vs-computer") {
      form.setValue("localPlayerCount", 1);
    }
  }

  function changeRoomSize(size: 2 | 3 | 4) {
    form.setValue("roomSize", size);
    if (mode === "with-others" && localPlayerCount > size) {
      form.setValue("localPlayerCount", size as 1 | 2 | 3 | 4);
    }
  }

  async function onSubmit(values: CreateRoomInput) {
    setSubmitting(true);
    try {
      const payload: CreateRoomInput =
        mode === "vs-computer"
          ? { ...values, localPlayerCount: 1, botCount: botOpponents as 0 | 1 | 2 | 3 }
          : { ...values, botCount: 0 };

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not create room.");
        return;
      }
      const result = data as JoinResult;
      saveRoomCredentials(result.room.roomId, {
        deviceGroupId: result.deviceGroupId,
        seats: result.credentials,
      });
      setOpen(false);
      router.push(`/room/${result.room.roomId}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a room</DialogTitle>
          <DialogDescription>
            {mode === "with-others"
              ? "You'll get a shareable link for anyone joining remotely."
              : "You play; the computer takes the other seats."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName">Your display name</Label>
            <Input
              id="displayName"
              placeholder="e.g. Alex"
              autoComplete="off"
              maxLength={20}
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Game mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeMode("with-others")}
                className={`rounded-md border p-2.5 text-sm font-medium transition-colors ${
                  mode === "with-others" ? "border-primary bg-accent" : "hover:bg-accent"
                }`}
              >
                With others
              </button>
              <button
                type="button"
                onClick={() => changeMode("vs-computer")}
                className={`rounded-md border p-2.5 text-sm font-medium transition-colors ${
                  mode === "vs-computer" ? "border-primary bg-accent" : "hover:bg-accent"
                }`}
              >
                Vs computer
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Total players in this match</Label>
            <RadioGroup
              value={String(roomSize)}
              onValueChange={(v) => changeRoomSize(Number(v) as 2 | 3 | 4)}
              className="grid grid-cols-3 gap-2"
            >
              {[2, 3, 4].map((n) => (
                <Label
                  key={n}
                  htmlFor={`size-${n}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-accent"
                >
                  <RadioGroupItem value={String(n)} id={`size-${n}`} />
                  {n} players
                </Label>
              ))}
            </RadioGroup>
            {roomSize === 2 && (
              <p className="text-xs text-muted-foreground">
                Two players sit diagonally opposite on the board, like a real
                1v1 match.
              </p>
            )}
          </div>

          {mode === "with-others" ? (
            <div className="space-y-2">
              <Label>How many players on this device?</Label>
              <RadioGroup
                value={String(localPlayerCount)}
                onValueChange={(v) =>
                  form.setValue("localPlayerCount", Number(v) as 1 | 2 | 3 | 4)
                }
                className="grid grid-cols-4 gap-2"
              >
                {Array.from({ length: roomSize }, (_, i) => i + 1).map((n) => (
                  <Label
                    key={n}
                    htmlFor={`local-${n}`}
                    className="flex cursor-pointer items-center justify-center gap-1 rounded-md border p-3 text-sm font-medium hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-accent"
                  >
                    <RadioGroupItem value={String(n)} id={`local-${n}`} />
                    {n}
                  </Label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                This reserves {localPlayerCount} of the {roomSize} seats for
                people playing on this device.{" "}
                {roomSize - localPlayerCount > 0
                  ? `Up to ${roomSize - localPlayerCount} more can join remotely with the invite link.`
                  : "All seats are filled on this device — no invite link needed."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;ll play against {botOpponents}{" "}
              {botOpponents === 1 ? "computer opponent" : "computer opponents"}.
              The match starts as soon as you&apos;re ready.
            </p>
          )}

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="quickMode">Quick match</Label>
              <p className="text-xs text-muted-foreground">
                2 tokens per player instead of 4 — great for a fast test game.
              </p>
            </div>
            <Switch
              id="quickMode"
              checked={quickMode}
              onCheckedChange={(v) => form.setValue("quickMode", v)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Create room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
