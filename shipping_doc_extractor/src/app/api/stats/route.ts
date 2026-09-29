import { NextResponse } from "next/server";
import { getDocumentStats } from "@/lib/db";

export async function GET() {
  try {
    const stats = await getDocumentStats();
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
