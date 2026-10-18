import { Bot, Dices, Smartphone, Users, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateRoomDialog } from "@/components/home/CreateRoomDialog";
import { JoinRoomDialog } from "@/components/home/JoinRoomDialog";
import { QuickTestButton } from "@/components/home/QuickTestButton";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground">
            <Dices className="size-4 text-red-500" />
            Classic Ludo, reimagined for the web
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
            Ludo Connect
          </h1>
          <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Play the Ludo you grew up with — mix friends on the same phone
            with friends across the world, all on one board, in real time.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <CreateRoomDialog>
              <Button size="lg" className="h-12 min-w-48 text-base">
                <Dices className="size-5" />
                Play Now
              </Button>
            </CreateRoomDialog>
            <JoinRoomDialog>
              <Button size="lg" variant="outline" className="h-12 min-w-48 text-base">
                Join Room
              </Button>
            </JoinRoomDialog>
            <CreateRoomDialog defaultMode="vs-computer">
              <Button size="lg" variant="outline" className="h-12 min-w-48 text-base">
                <Bot className="size-5" />
                Play vs Computer
              </Button>
            </CreateRoomDialog>
          </div>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
            <CreateRoomDialog>
              <button className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline">
                or create a room with a custom setup
              </button>
            </CreateRoomDialog>
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <QuickTestButton />
          </div>
        </header>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="size-5 text-blue-500" />
                <CardTitle>Local multiplayer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Hand the phone around. Up to four people can share one
              device, each with their own color and their own turn, all on
              the same board.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wifi className="size-5 text-emerald-500" />
                <CardTitle>Online multiplayer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Share an invitation link with anyone, anywhere. They pick a
              name and join instantly — no account required — and see the
              exact same board you do.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="size-5 text-violet-500" />
                <CardTitle>Vs computer</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No one around? Play against computer-controlled opponents, or
              jump into a quick test match to try out the rules in minutes.
            </CardContent>
          </Card>
        </section>

        <section className="mt-10 flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center">
          <Users className="size-6 text-amber-500" />
          <p className="max-w-md text-sm text-muted-foreground">
            Mix and match: three friends on one phone, and a fourth joining
            from another city — everyone plays the same match, together.
          </p>
        </section>
      </div>
    </main>
  );
}
