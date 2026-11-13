import SkillSwapRoom from "@/components/sections/skillswap-room";

export const instant = false;

export default async function SkillSwapRoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SkillSwapRoom sessionId={sessionId} />;
}
