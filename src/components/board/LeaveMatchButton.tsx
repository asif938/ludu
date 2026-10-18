"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Shared "leave match" confirmation, used in both the always-visible
 * desktop side panel and the mobile bottom-sheet menu. Leaving just
 * navigates home — the socket disconnect (not an explicit room:leave)
 * is what marks the seat disconnected-but-preserved, so it can resume
 * from the same device later. */
export function LeaveMatchButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className={className}>
            <LogOut className="size-4" />
            Leave match
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this match?</AlertDialogTitle>
          <AlertDialogDescription>
            The match keeps going without you. Your seat will show as
            disconnected, and you can rejoin from this device while the
            match is still active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={() => router.push("/")}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
