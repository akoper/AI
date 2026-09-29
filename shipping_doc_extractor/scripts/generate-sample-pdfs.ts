import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

async function generateSampleShippingPDFs() {
  const samplesDir = path.resolve(process.cwd(), "samples");
  if (!fs.existsSync(samplesDir)) {
    fs.mkdirSync(samplesDir, { recursive: true });
  }

  // 1. BILL OF LADING
  const bolDoc = await PDFDocument.create();
  const fontRegular = await bolDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await bolDoc.embedFont(StandardFonts.HelveticaBold);

  const bolPage = bolDoc.addPage([612, 792]); // Standard Letter
  const { width, height } = bolPage.getSize();

  // Header Box
  bolPage.drawRectangle({
    x: 40,
    y: height - 90,
    width: width - 80,
    height: 60,
    color: rgb(0.08, 0.2, 0.35),
  });

  bolPage.drawText("OCEAN BILL OF LADING", {
    x: 55,
    y: height - 55,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  bolPage.drawText("GLOBAL CONTAINER CARRIERS (GCC LINE)", {
    x: 55,
    y: height - 75,
    size: 10,
    font: fontRegular,
    color: rgb(0.85, 0.9, 0.95),
  });

  bolPage.drawText("B/L NO: GCC-2026-US98412", {
    x: width - 240,
    y: height - 55,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  bolPage.drawText("BOOKING REF: BKG-883491", {
    x: width - 240,
    y: height - 75,
    size: 10,
    font: fontRegular,
    color: rgb(0.85, 0.9, 0.95),
  });

  // Parties Section
  let y = height - 110;

  // Shipper box
  bolPage.drawRectangle({
    x: 40,
    y: y - 70,
    width: (width - 90) / 2,
    height: 70,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
  });
  bolPage.drawText("SHIPPER / EXPORTER:", { x: 48, y: y - 16, size: 9, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
  bolPage.drawText("PACIFIC LOGISTICS & INDUSTRIAL MFG CORP", { x: 48, y: y - 30, size: 9, font: fontBold });
  bolPage.drawText("1240 HARBOR BLVD, SUITE 800", { x: 48, y: y - 44, size: 8, font: fontRegular });
  bolPage.drawText("LONG BEACH, CA 90802, USA", { x: 48, y: y - 56, size: 8, font: fontRegular });

  // Consignee box
  bolPage.drawRectangle({
    x: 45 + (width - 90) / 2,
    y: y - 70,
    width: (width - 90) / 2,
    height: 70,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
  });
  bolPage.drawText("CONSIGNEE (RECEIVER):", { x: 53 + (width - 90) / 2, y: y - 16, size: 9, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
  bolPage.drawText("NIPPON ADVANCED TECHNOLOGIES LTD", { x: 53 + (width - 90) / 2, y: y - 30, size: 9, font: fontBold });
  bolPage.drawText("4-15-2 MINATO-KU, SHIBAURA", { x: 53 + (width - 90) / 2, y: y - 44, size: 8, font: fontRegular });
  bolPage.drawText("TOKYO 108-0023, JAPAN", { x: 53 + (width - 90) / 2, y: y - 56, size: 8, font: fontRegular });

  y -= 80;

  // Notify Party & Forwarder
  bolPage.drawRectangle({
    x: 40,
    y: y - 60,
    width: (width - 90) / 2,
    height: 60,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
  });
  bolPage.drawText("NOTIFY PARTY:", { x: 48, y: y - 14, size: 8, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
  bolPage.drawText("YOKOHAMA CUSTOMS & CLEARANCE SERVICES", { x: 48, y: y - 26, size: 8, font: fontRegular });
  bolPage.drawText("2-1 KAIGANDORI, YOKOHAMA, JAPAN", { x: 48, y: y - 38, size: 8, font: fontRegular });

  bolPage.drawRectangle({
    x: 45 + (width - 90) / 2,
    y: y - 60,
    width: (width - 90) / 2,
    height: 60,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
  });
  bolPage.drawText("FREIGHT FORWARDER / CARRIER:", { x: 53 + (width - 90) / 2, y: y - 14, size: 8, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
  bolPage.drawText("GLOBAL CONTAINER CARRIERS / DSV FORWARDING", { x: 53 + (width - 90) / 2, y: y - 26, size: 8, font: fontRegular });
  bolPage.drawText("SERVICE CONTRACT: SC-2026-9901", { x: 53 + (width - 90) / 2, y: y - 38, size: 8, font: fontRegular });

  y -= 70;

  // Route Grid
  bolPage.drawRectangle({
    x: 40,
    y: y - 50,
    width: width - 80,
    height: 50,
    color: rgb(0.95, 0.97, 0.99),
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
  });

  bolPage.drawText("VESSEL & VOYAGE:", { x: 48, y: y - 16, size: 8, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
  bolPage.drawText("GCC PACIFIC DISCOVERY / V.2608W", { x: 48, y: y - 30, size: 9, font: fontBold });

  bolPage.drawText("PORT OF LOADING:", { x: 230, y: y - 16, size: 8, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
  bolPage.drawText("PORT OF LOS ANGELES (USLAX)", { x: 230, y: y - 30, size: 9, font: fontRegular });

  bolPage.drawText("PORT OF DISCHARGE:", { x: 410, y: y - 16, size: 8, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
  bolPage.drawText("PORT OF YOKOHAMA (JPYOK)", { x: 410, y: y - 30, size: 9, font: fontRegular });

  bolPage.drawText("DATE OF ISSUE: 2026-09-18", { x: 48, y: y - 44, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  bolPage.drawText("SHIPPED ON BOARD DATE: 2026-09-22", { x: 230, y: y - 44, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  bolPage.drawText("EST. ARRIVAL: 2026-10-06", { x: 410, y: y - 44, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  y -= 60;

  // Cargo & Line Item Details Table
  bolPage.drawRectangle({
    x: 40,
    y: y - 20,
    width: width - 80,
    height: 20,
    color: rgb(0.2, 0.3, 0.4),
  });

  bolPage.drawText("CONTAINER & SEAL NO.", { x: 48, y: y - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  bolPage.drawText("PACKAGES & DESCRIPTION OF GOODS", { x: 180, y: y - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  bolPage.drawText("GROSS WEIGHT", { x: 420, y: y - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  bolPage.drawText("MEASUREMENT", { x: 505, y: y - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) });

  y -= 25;

  // Item 1
  bolPage.drawText("GCPU8812901 / 40HC", { x: 48, y: y, size: 8, font: fontBold });
  bolPage.drawText("SEAL: GCC99201", { x: 48, y: y - 12, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  bolPage.drawText("800 CARTONS (40 PALLETS)", { x: 180, y: y, size: 8, font: fontBold });
  bolPage.drawText("INDUSTRIAL SERVO MOTORS & CONTROLLERS", { x: 180, y: y - 12, size: 8, font: fontRegular });
  bolPage.drawText("HS CODE: 8501.52.20 | INCOTERMS: CIF TOKYO", { x: 180, y: y - 24, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  bolPage.drawText("16,400.00 KG", { x: 420, y: y, size: 8, font: fontBold });
  bolPage.drawText("58.40 CBM", { x: 505, y: y, size: 8, font: fontBold });

  y -= 45;

  // Item 2
  bolPage.drawText("MSKU7712093 / 40HC", { x: 48, y: y, size: 8, font: fontBold });
  bolPage.drawText("SEAL: GCC99202", { x: 48, y: y - 12, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  bolPage.drawText("400 CARTONS (20 PALLETS)", { x: 180, y: y, size: 8, font: fontBold });
  bolPage.drawText("AUTOMATED SENSOR MODULES & DIGITAL RELAYS", { x: 180, y: y - 12, size: 8, font: fontRegular });
  bolPage.drawText("HS CODE: 8537.10.91 | CLEAN ON BOARD", { x: 180, y: y - 24, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  bolPage.drawText("7,850.00 KG", { x: 420, y: y, size: 8, font: fontBold });
  bolPage.drawText("28.60 CBM", { x: 505, y: y, size: 8, font: fontBold });

  y -= 50;

  // Totals Box
  bolPage.drawRectangle({
    x: 40,
    y: y - 35,
    width: width - 80,
    height: 35,
    color: rgb(0.94, 0.96, 0.98),
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
  });

  bolPage.drawText("TOTAL PACKAGES: 1,200 CARTONS / 2x40' HIGH CUBE", { x: 48, y: y - 14, size: 8, font: fontBold });
  bolPage.drawText("TOTAL GROSS WEIGHT: 24,250.00 KG", { x: 48, y: y - 26, size: 8, font: fontBold });

  bolPage.drawText("TOTAL VOLUME: 87.00 CBM", { x: 260, y: y - 14, size: 8, font: fontBold });
  bolPage.drawText("NET WEIGHT: 22,100.00 KG", { x: 260, y: y - 26, size: 8, font: fontBold });

  bolPage.drawText("FREIGHT: PREPAID", { x: 430, y: y - 14, size: 8, font: fontBold, color: rgb(0.08, 0.4, 0.2) });
  bolPage.drawText("TOTAL AMOUNT: $88,400.00 USD", { x: 430, y: y - 26, size: 8, font: fontBold, color: rgb(0.08, 0.2, 0.4) });

  y -= 65;

  // Bottom Notes
  bolPage.drawText("SPECIAL HANDLING & INSTRUCTIONS:", { x: 48, y: y, size: 8, font: fontBold });
  bolPage.drawText("- Maintain container seal integrity until official customs release in Yokohama.", { x: 48, y: y - 14, size: 7.5, font: fontRegular });
  bolPage.drawText("- 14 calendar days free demurrage / detention period at destination terminal.", { x: 48, y: y - 26, size: 7.5, font: fontRegular });
  bolPage.drawText("- Temperature control ambient, dry cargo.", { x: 48, y: y - 38, size: 7.5, font: fontRegular });

  const bolBytes = await bolDoc.save();
  const bolPath = path.join(samplesDir, "sample_bill_of_lading.pdf");
  fs.writeFileSync(bolPath, bolBytes);
  console.log(`[Generated] Sample Bill of Lading written to: ${bolPath}`);

  // 2. COMMERCIAL FREIGHT INVOICE
  const invDoc = await PDFDocument.create();
  const invPage = invDoc.addPage([612, 792]);
  const invFontRegular = await invDoc.embedFont(StandardFonts.Helvetica);
  const invFontBold = await invDoc.embedFont(StandardFonts.HelveticaBold);

  // Header
  invPage.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 55,
    color: rgb(0.12, 0.35, 0.48),
  });

  invPage.drawText("COMMERCIAL SHIPPING INVOICE", {
    x: 55,
    y: height - 55,
    size: 16,
    font: invFontBold,
    color: rgb(1, 1, 1),
  });

  invPage.drawText("INVOICE NO: INV-2026-EXP-7704", {
    x: width - 240,
    y: height - 55,
    size: 11,
    font: invFontBold,
    color: rgb(1, 1, 1),
  });

  invPage.drawText("DATE: 2026-09-25 | DUE DATE: 2026-10-25", {
    x: width - 240,
    y: height - 72,
    size: 8.5,
    font: invFontRegular,
    color: rgb(0.9, 0.95, 1),
  });

  // Table items
  let iy = height - 110;
  invPage.drawText("EXPORTER / SELLER:", { x: 45, y: iy, size: 9, font: invFontBold });
  invPage.drawText("Euro-Atlantic Marine Equippers GmbH", { x: 45, y: iy - 14, size: 9, font: invFontRegular });
  invPage.drawText("Hafenstrasse 42, 20457 Hamburg, Germany", { x: 45, y: iy - 26, size: 8, font: invFontRegular });

  invPage.drawText("IMPORTER / BILL TO:", { x: 320, y: iy, size: 9, font: invFontBold });
  invPage.drawText("Atlantic Sea Navigation Corp", { x: 320, y: iy - 14, size: 9, font: invFontRegular });
  invPage.drawText("17 Battery Place, New York, NY 10004, USA", { x: 320, y: iy - 26, size: 8, font: invFontRegular });

  iy -= 55;
  invPage.drawRectangle({
    x: 40,
    y: iy - 40,
    width: width - 80,
    height: 40,
    color: rgb(0.96, 0.97, 0.98),
  });

  invPage.drawText("VESSEL: ATLANTIC HIGHWAY / V.102W", { x: 48, y: iy - 14, size: 8, font: invFontBold });
  invPage.drawText("POL: HAMBURG (DEHAM)  ->  POD: NEW YORK (USNYC)", { x: 48, y: iy - 28, size: 8, font: invFontRegular });
  invPage.drawText("INCOTERMS: CIF NEW YORK", { x: 340, y: iy - 14, size: 8, font: invFontBold });
  invPage.drawText("PAYMENT TERMS: NET 30 DAYS", { x: 340, y: iy - 28, size: 8, font: invFontRegular });

  iy -= 60;
  // Invoice items header
  invPage.drawRectangle({
    x: 40,
    y: iy - 18,
    width: width - 80,
    height: 18,
    color: rgb(0.25, 0.35, 0.45),
  });

  invPage.drawText("ITEM / DESCRIPTION", { x: 48, y: iy - 13, size: 8, font: invFontBold, color: rgb(1, 1, 1) });
  invPage.drawText("HS CODE", { x: 280, y: iy - 13, size: 8, font: invFontBold, color: rgb(1, 1, 1) });
  invPage.drawText("QTY", { x: 370, y: iy - 13, size: 8, font: invFontBold, color: rgb(1, 1, 1) });
  invPage.drawText("UNIT PRICE", { x: 430, y: iy - 13, size: 8, font: invFontBold, color: rgb(1, 1, 1) });
  invPage.drawText("TOTAL (USD)", { x: 505, y: iy - 13, size: 8, font: invFontBold, color: rgb(1, 1, 1) });

  iy -= 24;
  invPage.drawText("1. Marine Radar Transponders Model RX-900", { x: 48, y: iy, size: 8, font: invFontBold });
  invPage.drawText("8526.10.00", { x: 280, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("20 PCS", { x: 370, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("$1,850.00", { x: 430, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("$37,000.00", { x: 505, y: iy, size: 8, font: invFontBold });

  iy -= 22;
  invPage.drawText("2. Gyro Compass Master Repeaters", { x: 48, y: iy, size: 8, font: invFontBold });
  invPage.drawText("9014.10.80", { x: 280, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("10 UNITS", { x: 370, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("$2,400.00", { x: 430, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("$24,000.00", { x: 505, y: iy, size: 8, font: invFontBold });

  iy -= 22;
  invPage.drawText("3. Ocean Freight & Bunker Adjustment (BAF)", { x: 48, y: iy, size: 8, font: invFontBold });
  invPage.drawText("9900.00.00", { x: 280, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("1 LOT", { x: 370, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("$4,500.00", { x: 430, y: iy, size: 8, font: invFontRegular });
  invPage.drawText("$4,500.00", { x: 505, y: iy, size: 8, font: invFontBold });

  iy -= 40;
  // Financial Summary
  invPage.drawRectangle({
    x: 320,
    y: iy - 80,
    width: width - 360,
    height: 80,
    color: rgb(0.96, 0.98, 1),
    borderColor: rgb(0.7, 0.8, 0.9),
    borderWidth: 1,
  });

  invPage.drawText("SUBTOTAL:", { x: 330, y: iy - 18, size: 8, font: invFontRegular });
  invPage.drawText("$61,000.00", { x: 480, y: iy - 18, size: 8, font: invFontRegular });

  invPage.drawText("OCEAN FREIGHT:", { x: 330, y: iy - 32, size: 8, font: invFontRegular });
  invPage.drawText("$4,500.00", { x: 480, y: iy - 32, size: 8, font: invFontRegular });

  invPage.drawText("INSURANCE & HANDLING:", { x: 330, y: iy - 46, size: 8, font: invFontRegular });
  invPage.drawText("$1,250.00", { x: 480, y: iy - 46, size: 8, font: invFontRegular });

  invPage.drawText("TOTAL INVOICE AMOUNT:", { x: 330, y: iy - 66, size: 9, font: invFontBold, color: rgb(0.08, 0.35, 0.2) });
  invPage.drawText("$66,750.00 USD", { x: 460, y: iy - 66, size: 9, font: invFontBold, color: rgb(0.08, 0.35, 0.2) });

  const invBytes = await invDoc.save();
  const invPath = path.join(samplesDir, "sample_commercial_invoice.pdf");
  fs.writeFileSync(invPath, invBytes);
  console.log(`[Generated] Sample Commercial Invoice written to: ${invPath}`);
}

generateSampleShippingPDFs().catch(console.error);
