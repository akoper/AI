import fs from "fs";
import path from "path";
import { insertShippingDocument, getShippingDocumentById, getAllShippingDocuments } from "../src/lib/db";
import { logger } from "../src/lib/logger";
import { ShippingDocument } from "../src/types/document";

async function runLoggerVerification() {
  logger.banner("SHIPPING INVOICE & DOCUMENT EXTRACTION PIPELINE", "Testing Terminal Logging & Database Storage");

  const samplePath = path.resolve(process.cwd(), "samples", "sample_commercial_invoice.pdf");
  if (!fs.existsSync(samplePath)) {
    logger.error("FILE_CHECK", `Sample file not found at: ${samplePath}`);
    return;
  }

  const pdfBuffer = fs.readFileSync(samplePath);
  logger.step("FILE_LOAD", `Loaded sample invoice PDF (${(pdfBuffer.length / 1024).toFixed(1)} KB) from disk`);

  logger.info("PARSING_SIM", "Simulating Gemini multimodal entity extraction for sample invoice...");

  const extractedDoc: ShippingDocument = {
    id: `doc_inv_${Date.now()}`,
    file_name: "sample_commercial_invoice.pdf",
    file_size: pdfBuffer.length,
    file_type: "application/pdf",
    document_type: "COMMERCIAL_INVOICE",
    status: "PROCESSED",
    document_number: "INV-2026-EXP-7704",
    invoice_number: "INV-2026-EXP-7704",
    booking_number: "BKG-EU-9921",
    reference_number: "PO-881923",
    document_date: "2026-09-25",
    due_date: "2026-10-25",
    shipper_name: "Euro-Atlantic Marine Equippers GmbH",
    shipper_address: "Hafenstrasse 42, 20457 Hamburg, Germany",
    consignee_name: "Atlantic Sea Navigation Corp",
    consignee_address: "17 Battery Place, New York, NY 10004, USA",
    notify_party_name: "NY Harbor Customs Logistics Inc",
    notify_party_address: "Port of New York Terminal 4, NY 10004",
    carrier_name: "Atlantic Container Line",
    freight_forwarder_name: "Kuehne + Nagel Logistics",
    vessel_name: "ATLANTIC HIGHWAY",
    voyage_number: "V.102W",
    port_of_loading: "Port of Hamburg (DEHAM)",
    port_of_discharge: "Port of New York (USNYC)",
    incoterms: "CIF",
    payment_terms: "NET 30 DAYS",
    currency: "USD",
    subtotal_amount: 61000.0,
    tax_amount: 0.0,
    freight_charges: 4500.0,
    other_charges: 1250.0,
    total_amount: 66750.0,
    total_packages: 31,
    package_type_summary: "30 Packages / 1 Lot",
    gross_weight_kg: 8900.0,
    net_weight_kg: 8100.0,
    measurement_cbm: 24.5,
    goods_description: "Marine radar transponders, gyro compass master repeaters, ocean freight",
    confidence_score: 0.98,
    notes: "Special handling: Sensitive navigational instruments. Keep dry.",
    line_items: [
      {
        item_number: "1",
        description: "Marine Radar Transponders Model RX-900",
        hs_code: "8526.10.00",
        quantity: 20,
        unit_of_measure: "PCS",
        unit_price: 1850.0,
        total_price: 37000.0,
        weight_kg: 4200.0,
        volume_cbm: 12.0,
        package_type: "Carton",
        package_count: 20,
      },
      {
        item_number: "2",
        description: "Gyro Compass Master Repeaters",
        hs_code: "9014.10.80",
        quantity: 10,
        unit_of_measure: "UNITS",
        unit_price: 2400.0,
        total_price: 24000.0,
        weight_kg: 3900.0,
        volume_cbm: 10.5,
        package_type: "Wooden Crate",
        package_count: 10,
      },
      {
        item_number: "3",
        description: "Ocean Freight & Bunker Adjustment (BAF)",
        hs_code: "9900.00.00",
        quantity: 1,
        unit_of_measure: "LOT",
        unit_price: 4500.0,
        total_price: 4500.0,
        weight_kg: 0,
        volume_cbm: 0,
        package_type: "Service",
        package_count: 1,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  logger.step("DB_WRITE", `Inserting extracted invoice into SQLite database...`);
  const saved = await insertShippingDocument(extractedDoc);

  logger.success("DB_VERIFY", `Retrieving newly stored record from SQLite to verify integrity...`);
  const fetched = await getShippingDocumentById(saved.id);

  if (fetched && fetched.line_items?.length === 3) {
    logger.success("VERIFICATION_COMPLETE", `Successfully verified document ${fetched.document_number}`, {
      document_id: fetched.id,
      invoice_number: fetched.invoice_number,
      shipper: fetched.shipper_name,
      consignee: fetched.consignee_name,
      total_amount: `$${fetched.total_amount} ${fetched.currency}`,
      line_items_stored: fetched.line_items.length,
      first_item: fetched.line_items[0].description,
    });
  } else {
    logger.error("VERIFICATION_FAIL", "Stored document verification did not return expected line items");
  }

  const allDocs = await getAllShippingDocuments();
  logger.info("DB_SUMMARY", `Total shipping documents currently in SQLite database: ${allDocs.length}`);
}

runLoggerVerification().catch((err) => {
  logger.error("RUNNER", "Fatal error during verification", err);
});
