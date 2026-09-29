import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractionResult, ShippingDocument } from "../types/document";
import { logger } from "./logger";

const SYSTEM_PROMPT = `
You are an expert shipping, customs, and maritime logistics document parser.
Your task is to analyze the provided shipping document (which could be a Bill of Lading, Commercial Invoice, Freight Invoice, Packing List, Customs Declaration, Delivery Order, or Shipping Instruction) and extract all critical fields with high accuracy.

Extract the following JSON structure precisely:
{
  "document_type": "BILL_OF_LADING" | "COMMERCIAL_INVOICE" | "FREIGHT_INVOICE" | "PACKING_LIST" | "CUSTOMS_DECLARATION" | "DELIVERY_ORDER" | "SHIPPING_INSTRUCTION" | "OTHER",
  "document_number": "string (e.g. B/L number, Invoice number, Reference number)",
  "invoice_number": "string (if present)",
  "booking_number": "string (if present)",
  "reference_number": "string (shipper or forwarder ref)",
  "document_date": "YYYY-MM-DD (ISO date format)",
  "due_date": "YYYY-MM-DD (payment due date if specified)",
  
  "shipper_name": "string (company or individual sending cargo)",
  "shipper_address": "string",
  "consignee_name": "string (receiver or 'TO ORDER OF...')",
  "consignee_address": "string",
  "notify_party_name": "string (party to notify upon arrival)",
  "notify_party_address": "string",
  "carrier_name": "string (ocean carrier, airline, or trucking company)",
  "freight_forwarder_name": "string (logistics intermediary)",
  
  "vessel_name": "string (ocean vessel name)",
  "voyage_number": "string (voyage / flight / trip ID)",
  "port_of_loading": "string (origin port/airport/terminal)",
  "port_of_discharge": "string (destination port/airport/terminal)",
  "place_of_receipt": "string (origin pickup point)",
  "place_of_delivery": "string (final destination)",
  "departure_date": "YYYY-MM-DD",
  "arrival_date": "YYYY-MM-DD",
  
  "incoterms": "FOB | CIF | CFR | EXW | DDP | DAP | FCA | CIP | etc.",
  "payment_terms": "string (e.g. Net 30, LC at sight, Pre-paid, Collect)",
  "currency": "string (e.g. USD, EUR, GBP, CNY)",
  "subtotal_amount": number (float),
  "tax_amount": number (float),
  "freight_charges": number (float),
  "other_charges": number (float),
  "total_amount": number (float),
  
  "total_packages": number (integer/float),
  "package_type_summary": "string (e.g. 24 Pallets, 500 Cartons, 20 Drums)",
  "gross_weight_kg": number (float in Kilograms),
  "net_weight_kg": number (float in Kilograms),
  "measurement_cbm": number (float in Cubic Meters),
  "goods_description": "string (general summary of goods / commodities)",
  
  "containers": [
    {
      "container_number": "string (e.g. MSCU1234567, TCLU8910112)",
      "seal_number": "string",
      "container_type": "string (e.g. 20GP, 40HC, 40GP, 45HQ, Reefer, Flat Rack)",
      "gross_weight_kg": number,
      "tare_weight_kg": number,
      "net_weight_kg": number,
      "measurement_cbm": number,
      "packages_count": number
    }
  ],
  
  "line_items": [
    {
      "item_number": "string",
      "description": "string",
      "hs_code": "string (Harmonized Tariff Schedule code)",
      "quantity": number,
      "unit_of_measure": "string (e.g. PCS, UNITS, KG, CTN)",
      "unit_price": number,
      "total_price": number,
      "weight_kg": number,
      "volume_cbm": number,
      "package_type": "string",
      "package_count": number
    }
  ],
  
  "confidence_score": number (between 0.0 and 1.0 indicating extraction certainty),
  "notes": "string (special handling instructions, hazardous notes, demurrage terms, temperature requirements)"
}

Rules:
1. Return strictly a raw JSON object. Do not include markdown code fences (\`\`\`json or \`\`\`), explanatory text, or commentary.
2. If any field is not found in the document, set its value to null (or omit).
3. Convert weights to kg and volumes to cbm if units like lbs or cuft are specified (indicate conversions if necessary).
4. For numbers, use valid JavaScript floats/integers without comma separators or currency symbols.
5. Accurately distinguish Bill of Lading, Commercial Invoice, Freight Invoice, and Packing List.
`;

const DEFAULT_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

async function callGeminiWithModelFallback(
  genAI: GoogleGenerativeAI,
  candidateModels: string[],
  contents: any[],
  stageName: string
): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      logger.step(stageName, `Attempting Google Gemini call with model: ${model}...`);
      const generativeModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const startTime = Date.now();
      const response = await generativeModel.generateContent(contents);
      const durationMs = Date.now() - startTime;
      logger.success("GEMINI_RESPONSE", `Received response from Gemini (${model}) in ${(durationMs / 1000).toFixed(2)}s`);

      const text = response.response.text();
      return { text, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const isModelUnavailable =
        err.message?.includes("404") ||
        err.message?.includes("not found") ||
        err.message?.includes("not supported for generateContent") ||
        err.status === 404;

      if (isModelUnavailable) {
        logger.warn(
          "MODEL_UNAVAILABLE",
          `Model "${model}" not found or unsupported for API endpoint (${err.message}). Trying next candidate...`
        );
        continue;
      }

      logger.warn("MODEL_CALL_WARN", `Call with model "${model}" failed: ${err.message}. Trying next candidate...`);
    }
  }

  throw lastError || new Error("All candidate Gemini models failed to generate content.");
}

export async function extractDocumentWithGemini(
  pdfBuffer: Buffer,
  fileName: string,
  apiKeyOverride?: string
): Promise<ExtractionResult> {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

  logger.banner("Starting Gemini AI Document Extraction", `File: ${fileName} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    logger.error("GEMINI_AUTH", "Google Gemini API Key is missing or invalid");
    return {
      success: false,
      error: "Google Gemini API Key is missing. Please provide a valid GEMINI_API_KEY in your environment or via the request.",
    };
  }

  const requestedModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const candidateModels = Array.from(new Set([requestedModel, ...FALLBACK_MODELS]));
  logger.info("GEMINI_INIT", `Target model: ${requestedModel} (Fallback candidates: ${candidateModels.join(", ")})`);

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const base64Data = pdfBuffer.toString("base64");
    logger.step("GEMINI_PAYLOAD", `Prepared base64 PDF inline data payload (${(base64Data.length / 1024).toFixed(1)} KB encoded)`);

    const part = {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf",
      },
    };

    const prompt = `${SYSTEM_PROMPT}\n\nDocument File Name: ${fileName}\nPlease extract all data from this PDF file.`;

    const { text: responseText, modelUsed } = await callGeminiWithModelFallback(
      genAI,
      candidateModels,
      [prompt, part],
      "GEMINI_CALL"
    );

    const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    logger.step("PARSING", "Parsing structured JSON response from Gemini");
    const parsedData = JSON.parse(cleaned);

    const docType = parsedData.document_type || "UNKNOWN";
    const docNumber = parsedData.document_number || parsedData.invoice_number || "N/A";
    const totalAmount = parsedData.total_amount ? `${parsedData.currency || "$"} ${parsedData.total_amount}` : "N/A";
    const lineItemCount = Array.isArray(parsedData.line_items) ? parsedData.line_items.length : 0;
    const containerCount = Array.isArray(parsedData.containers) ? parsedData.containers.length : 0;

    logger.success("EXTRACTION_OK", `Extracted ${docType} #${docNumber} using ${modelUsed}`, {
      document_type: docType,
      document_number: docNumber,
      shipper: parsedData.shipper_name || "N/A",
      consignee: parsedData.consignee_name || "N/A",
      total_amount: totalAmount,
      line_items_count: lineItemCount,
      containers_count: containerCount,
      confidence_score: parsedData.confidence_score,
      model_used: modelUsed,
    });

    return {
      success: true,
      data: {
        file_name: fileName,
        file_size: pdfBuffer.length,
        file_type: "application/pdf",
        status: "PROCESSED",
        ...parsedData,
      },
      raw_response: cleaned,
    };
  } catch (error: any) {
    logger.warn("FALLBACK_MODE", `Primary multimodal inline extraction failed: ${error.message}. Attempting text fallback...`);
    try {
      return await fallbackTextExtraction(pdfBuffer, fileName, genAI, candidateModels, error.message);
    } catch (fallbackError: any) {
      logger.error("EXTRACTION_FAIL", `Document extraction failed completely`, {
        primaryError: error.message,
        fallbackError: fallbackError.message,
      });
      return {
        success: false,
        error: `Gemini document extraction failed: ${error.message || error}. Fallback error: ${fallbackError.message || fallbackError}`,
      };
    }
  }
}

async function fallbackTextExtraction(
  pdfBuffer: Buffer,
  fileName: string,
  genAI: GoogleGenerativeAI,
  candidateModels: string[],
  originalError: string
): Promise<ExtractionResult> {
  logger.step("TEXT_PARSER", "Attempting text extraction from PDF buffer");
  let textContent = "";

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const parsedPdf = await pdfParse(pdfBuffer);
    if (parsedPdf && parsedPdf.text && parsedPdf.text.trim().length > 0) {
      textContent = parsedPdf.text.trim();
    }
  } catch (pdfParseError: any) {
    logger.warn("PDF_PARSE_WARN", `pdf-parse failed (${pdfParseError.message || pdfParseError}). Trying raw stream extraction...`);
  }

  if (!textContent) {
    try {
      const bufferStr = pdfBuffer.toString("latin1");
      const textMatches: string[] = [];
      const streamRegex = /BT[\s\S]*?ET/g;
      let match;
      while ((match = streamRegex.exec(bufferStr)) !== null) {
        const block = match[0];
        const stringRegex = /\((.*?)\)|\[(.*?)\]/g;
        let strMatch;
        while ((strMatch = stringRegex.exec(block)) !== null) {
          const text = strMatch[1] || strMatch[2];
          if (text && text.trim().length > 0) {
            textMatches.push(text.trim());
          }
        }
      }
      if (textMatches.length > 0) {
        textContent = textMatches.join(" ");
      }
    } catch (rawErr: any) {
      logger.warn("RAW_EXTRACT_WARN", `Raw buffer extraction failed: ${rawErr.message}`);
    }
  }

  if (!textContent || textContent.trim().length === 0) {
    throw new Error(`PDF contained no extractable text stream and visual multimodal extraction failed (${originalError})`);
  }

  logger.info("TEXT_PARSER", `Extracted ${textContent.length} characters of text from PDF`);

  const prompt = `${SYSTEM_PROMPT}\n\nDocument File Name: ${fileName}\n\nDocument Text Content:\n${textContent}`;
  const { text: responseText, modelUsed } = await callGeminiWithModelFallback(
    genAI,
    candidateModels,
    [prompt],
    "GEMINI_FALLBACK"
  );

  const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsedData = JSON.parse(cleaned);

  logger.success("EXTRACTION_OK", `Fallback extracted ${parsedData.document_type || "UNKNOWN"} #${parsedData.document_number || "N/A"} using ${modelUsed}`);

  return {
    success: true,
    data: {
      file_name: fileName,
      file_size: pdfBuffer.length,
      file_type: "application/pdf",
      raw_text: textContent,
      status: "PROCESSED",
      ...parsedData,
    },
    raw_response: cleaned,
  };
}
