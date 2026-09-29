import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const logs = logger.getRecentLogs(limit);

  return NextResponse.json({
    success: true,
    count: logs.length,
    logs,
  });
}

export async function DELETE() {
  logger.clearLogs();
  logger.info("LOG_MANAGER", "Log history cleared");
  return NextResponse.json({
    success: true,
    message: "Logs cleared",
  });
}
