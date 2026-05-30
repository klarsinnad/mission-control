import { listStudioImages } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const images = await listStudioImages();
  return Response.json({ images });
}
