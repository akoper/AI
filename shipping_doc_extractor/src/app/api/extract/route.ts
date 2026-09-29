import { NextRequest, NextResponse } from "next/server";
import { extractDocumentWithGemini } from "@/lib/gemini";
import { insertShippingDocument } from "@/lib/db";
import { ShippingDocument } from "@/types/document";
import { logger } from "@/lib/logger";

export const maxDuration = 60; // Allow 60s for Gemini extraction

export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  try {
    logger.banner("API Request: Extract Shipping Document", `Endpoint: POST /api/extract`);
    
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const saveToDb = formData.get("save_to_db") === "true";
    const apiKeyOverride = formData.get("gemini_api_key") as string | null;

    if (!file) {
      logger.error("API_BAD_REQUEST", "No file provided in POST request payload");
      return NextResponse.json(
        { success: false, error: "No file was provided in the request" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    logger.step("FILE_INGEST", `Received file "${fileName}" (${(pdfBuffer.length / 1024).toFixed(1)} KB, mime: ${file.type || "application/pdf"})`);
    logger.info("EXTRACTION_CONFIG", `Save to Database: ${saveToDb ? "YES" : "NO"} | Custom Key: ${apiKeyOverride ? "PROVIDED" : "DEFAULT"}`);

    // Call Gemini to parse and extract fields
    logger.step("GEMINI_START", `Initiating Google Gemini parsing pipeline for ${fileName}...`);
    const extractionResult = await extractDocumentWithGemini(
      pdfBuffer,
      fileName,
      apiKeyOverride || undefined
    );

    if (!extractionResult.success || !extractionResult.data) {
      logger.error("EXTRACTION_ERROR", `Failed to parse document with Gemini: ${extractionResult.error}`);
      return NextResponse.json(
        {
          success: false,
          error: extractionResult.error || "Gemini was unable to extract fields from document",
        },
        { status: 422 }
      );
    }

    let savedDocument: ShippingDocument | null = null;
    if (saveToDb) {
      logger.step("DB_PERSIST", `Persisting extracted document data into SQLite database`);
      const docToSave: ShippingDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file_name: fileName,
        file_size: pdfBuffer.length,
        file_type: file.type || "application/pdf",
        document_type: extractionResult.data.document_type || "OTHER",
        status: "PROCESSED",
        ...extractionResult.data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ShippingDocument;

      savedDocument = await insertShippingDocument(docToSave);
      logger.success("DB_PERSIST_OK", `Document record successfully saved to database with ID: ${savedDocument.id}`);
    }

    const totalDuration = ((Date.now() - requestStart) / 1000).toFixed(2);
    logger.banner("Extraction & Storage Completed Successfully", `Total processing time: ${totalDuration}s`);

    return NextResponse.json({
      success: true,
      extracted: extractionResult.data,
      saved_document: savedDocument,
      processing_time_sec: totalDuration,
      message: saveToDb
        ? "Document successfully processed by Gemini and saved to database"
        : "Document extracted successfully",
    });
  } catch (error: any) {
    logger.error("API_FATAL", `Unhandled error during extraction process: ${error.message || error}`, error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during extraction",
      },
      { status: 500 }
    );
  }
}
