import { NextRequest, NextResponse } from "next/server";
import { getShippingDocumentById, updateShippingDocument, deleteShippingDocument } from "@/lib/db";
import { ShippingDocument } from "@/types/document";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const document = await getShippingDocumentById(id);

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve document" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const updates = (await request.json()) as Partial<ShippingDocument>;

    const updatedDoc = await updateShippingDocument(id, updates);

    if (!updatedDoc) {
      return NextResponse.json(
        { success: false, error: "Document not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedDoc,
      message: "Document updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const success = await deleteShippingDocument(id);

    return NextResponse.json({
      success,
      message: "Document and related line items deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
