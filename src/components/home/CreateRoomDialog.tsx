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
import { createRoomSchema, type CreateRoomInput } from "@/lib/validation/schemas";
import { saveRoomCredentials } from "@/lib/device/session";
import type { JoinResult } from "@/lib/rooms/types";

export function CreateRoomDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateRoomInput>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: { displayName: "", localPlayerCount: 1 },
  });

  async function onSubmit(values: CreateRoomInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
            You&apos;ll get a shareable link for anyone joining remotely.
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
            <Label>How many players on this device?</Label>
            <RadioGroup
              value={String(form.watch("localPlayerCount"))}
              onValueChange={(v) =>
                form.setValue("localPlayerCount", Number(v) as 1 | 2 | 3)
              }
              className="grid grid-cols-3 gap-2"
            >
              {[1, 2, 3].map((n) => (
                <Label
                  key={n}
                  htmlFor={`local-${n}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-md border p-3 text-sm font-medium hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-accent"
                >
                  <RadioGroupItem value={String(n)} id={`local-${n}`} />
                  {n} {n === 1 ? "player" : "players"}
                </Label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              This reserves {form.watch("localPlayerCount")} of the 4 seats for
              people playing on this device. Up to {4 - form.watch("localPlayerCount")}{" "}
              more can join remotely with the invite link.
            </p>
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
