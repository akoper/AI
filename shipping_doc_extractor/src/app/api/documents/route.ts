import { NextRequest, NextResponse } from "next/server";
import { getAllShippingDocuments, insertShippingDocument, getDocumentStats } from "@/lib/db";
import { ShippingDocument } from "@/types/document";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const document_type = searchParams.get("document_type") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    const documents = await getAllShippingDocuments({
      document_type,
      status,
      search,
    });

    const stats = await getDocumentStats();

    return NextResponse.json({
      success: true,
      data: documents,
      stats,
    });
  } catch (error: any) {
    logger.error("API_DOCS_GET", `Failed to retrieve documents: ${error.message || error}`);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve documents",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ShippingDocument;

    if (!body.file_name) {
      logger.error("API_DOCS_POST", "Missing file_name in document payload");
      return NextResponse.json(
        { success: false, error: "file_name is required" },
        { status: 400 }
      );
    }

    logger.step("API_DOCS_POST", `Direct API request to insert document "${body.file_name}"`);
    const savedDoc = await insertShippingDocument(body);

    return NextResponse.json(
      {
        success: true,
        data: savedDoc,
        message: "Document successfully saved to database table",
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error("API_DOCS_POST", `Failed to insert document: ${error.message || error}`);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create document",
      },
      { status: 500 }
    );
  }
}
