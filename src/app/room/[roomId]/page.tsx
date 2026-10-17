import { RoomClient } from "@/components/room/RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return (
    <main className="flex flex-1 flex-col">
      <RoomClient roomId={roomId.toUpperCase()} />
    </main>
  );
}
