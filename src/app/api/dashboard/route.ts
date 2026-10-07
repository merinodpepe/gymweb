import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { getDashboard } from "@/services/dashboardService";

export const GET = handle(async (req: NextRequest) => {
  return NextResponse.json(await getDashboard(req.nextUrl.searchParams.get("range") ?? "90d"));
});
