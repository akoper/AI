import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import { ShippingDocument, LineItem, ContainerDetail } from "../types/document";
import { logger } from "./logger";

let dbInstance: Database | null = null;
let SQL: any = null;

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "shipping_docs.db");

// Ensure data folder exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function findWasmPath(): string | null {
  const candidatePaths = [
    path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    path.join(process.cwd(), ".next", "standalone", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    path.join(process.cwd(), "public", "sql-wasm.wasm"),
    path.join(process.cwd(), "sql-wasm.wasm"),
    "/app/node_modules/sql.js/dist/sql-wasm.wasm",
    "/app/sql-wasm.wasm",
    "/app/public/sql-wasm.wasm",
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!SQL) {
    const wasmPath = findWasmPath();
    if (wasmPath) {
      try {
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmBinary = wasmBuffer.buffer.slice(
          wasmBuffer.byteOffset,
          wasmBuffer.byteOffset + wasmBuffer.byteLength
        ) as ArrayBuffer;
        SQL = await initSqlJs({
          locateFile: () => wasmPath,
          wasmBinary,
        });
      } catch (err: any) {
        logger.warn("DB_WASM_LOAD", `Failed reading wasmBinary from ${wasmPath} (${err.message}), trying locateFile fallback`);
        SQL = await initSqlJs({
          locateFile: () => wasmPath,
        });
      }
    } else {
      SQL = await initSqlJs();
    }
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    if (dbInstance) {
      initSchema(dbInstance);
      saveDatabase();
    }
  }

  if (dbInstance) {
    initSchema(dbInstance);
  }
  return dbInstance!;
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function initSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS shipping_documents (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      raw_text TEXT,
      document_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PROCESSED',
      document_number TEXT,
      invoice_number TEXT,
      booking_number TEXT,
      reference_number TEXT,
      document_date TEXT,
      due_date TEXT,
      shipper_name TEXT,
      shipper_address TEXT,
      consignee_name TEXT,
      consignee_address TEXT,
      notify_party_name TEXT,
      notify_party_address TEXT,
      carrier_name TEXT,
      freight_forwarder_name TEXT,
      vessel_name TEXT,
      voyage_number TEXT,
      port_of_loading TEXT,
      port_of_discharge TEXT,
      place_of_receipt TEXT,
      place_of_delivery TEXT,
      departure_date TEXT,
      arrival_date TEXT,
      incoterms TEXT,
      payment_terms TEXT,
      currency TEXT,
      subtotal_amount REAL,
      tax_amount REAL,
      freight_charges REAL,
      other_charges REAL,
      total_amount REAL,
      total_packages REAL,
      package_type_summary TEXT,
      gross_weight_kg REAL,
      net_weight_kg REAL,
      measurement_cbm REAL,
      goods_description TEXT,
      confidence_score REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      item_number TEXT,
      description TEXT NOT NULL,
      hs_code TEXT,
      quantity REAL,
      unit_of_measure TEXT,
      unit_price REAL,
      total_price REAL,
      weight_kg REAL,
      volume_cbm REAL,
      package_type TEXT,
      package_count REAL,
      FOREIGN KEY(document_id) REFERENCES shipping_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS container_details (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      container_number TEXT NOT NULL,
      seal_number TEXT,
      container_type TEXT,
      gross_weight_kg REAL,
      tare_weight_kg REAL,
      net_weight_kg REAL,
      measurement_cbm REAL,
      packages_count REAL,
      FOREIGN KEY(document_id) REFERENCES shipping_documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_doc_type ON shipping_documents(document_type);
    CREATE INDEX IF NOT EXISTS idx_doc_number ON shipping_documents(document_number);
    CREATE INDEX IF NOT EXISTS idx_doc_date ON shipping_documents(document_date);
    CREATE INDEX IF NOT EXISTS idx_line_items_doc ON line_items(document_id);
    CREATE INDEX IF NOT EXISTS idx_containers_doc ON container_details(document_id);
  `);
}

export async function insertShippingDocument(doc: ShippingDocument): Promise<ShippingDocument> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const docId = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = doc.created_at || now;
  const updatedAt = now;

  logger.step("SQL_INSERT", `Writing document record into 'shipping_documents' table [ID: ${docId}]`);

  const stmt = db.prepare(`
    INSERT INTO shipping_documents (
      id, file_name, file_size, file_type, raw_text, document_type, status,
      document_number, invoice_number, booking_number, reference_number,
      document_date, due_date, shipper_name, shipper_address,
      consignee_name, consignee_address, notify_party_name, notify_party_address,
      carrier_name, freight_forwarder_name, vessel_name, voyage_number,
      port_of_loading, port_of_discharge, place_of_receipt, place_of_delivery,
      departure_date, arrival_date, incoterms, payment_terms, currency,
      subtotal_amount, tax_amount, freight_charges, other_charges, total_amount,
      total_packages, package_type_summary, gross_weight_kg, net_weight_kg,
      measurement_cbm, goods_description, confidence_score, notes,
      created_at, updated_at
    ) VALUES (
      $id, $file_name, $file_size, $file_type, $raw_text, $document_type, $status,
      $document_number, $invoice_number, $booking_number, $reference_number,
      $document_date, $due_date, $shipper_name, $shipper_address,
      $consignee_name, $consignee_address, $notify_party_name, $notify_party_address,
      $carrier_name, $freight_forwarder_name, $vessel_name, $voyage_number,
      $port_of_loading, $port_of_discharge, $place_of_receipt, $place_of_delivery,
      $departure_date, $arrival_date, $incoterms, $payment_terms, $currency,
      $subtotal_amount, $tax_amount, $freight_charges, $other_charges, $total_amount,
      $total_packages, $package_type_summary, $gross_weight_kg, $net_weight_kg,
      $measurement_cbm, $goods_description, $confidence_score, $notes,
      $created_at, $updated_at
    )
  `);

  stmt.run({
    $id: docId,
    $file_name: doc.file_name,
    $file_size: doc.file_size ?? null,
    $file_type: doc.file_type ?? "application/pdf",
    $raw_text: doc.raw_text ?? null,
    $document_type: doc.document_type || "OTHER",
    $status: doc.status || "PROCESSED",
    $document_number: doc.document_number ?? null,
    $invoice_number: doc.invoice_number ?? null,
    $booking_number: doc.booking_number ?? null,
    $reference_number: doc.reference_number ?? null,
    $document_date: doc.document_date ?? null,
    $due_date: doc.due_date ?? null,
    $shipper_name: doc.shipper_name ?? null,
    $shipper_address: doc.shipper_address ?? null,
    $consignee_name: doc.consignee_name ?? null,
    $consignee_address: doc.consignee_address ?? null,
    $notify_party_name: doc.notify_party_name ?? null,
    $notify_party_address: doc.notify_party_address ?? null,
    $carrier_name: doc.carrier_name ?? null,
    $freight_forwarder_name: doc.freight_forwarder_name ?? null,
    $vessel_name: doc.vessel_name ?? null,
    $voyage_number: doc.voyage_number ?? null,
    $port_of_loading: doc.port_of_loading ?? null,
    $port_of_discharge: doc.port_of_discharge ?? null,
    $place_of_receipt: doc.place_of_receipt ?? null,
    $place_of_delivery: doc.place_of_delivery ?? null,
    $departure_date: doc.departure_date ?? null,
    $arrival_date: doc.arrival_date ?? null,
    $incoterms: doc.incoterms ?? null,
    $payment_terms: doc.payment_terms ?? null,
    $currency: doc.currency ?? "USD",
    $subtotal_amount: doc.subtotal_amount ?? null,
    $tax_amount: doc.tax_amount ?? null,
    $freight_charges: doc.freight_charges ?? null,
    $other_charges: doc.other_charges ?? null,
    $total_amount: doc.total_amount ?? null,
    $total_packages: doc.total_packages ?? null,
    $package_type_summary: doc.package_type_summary ?? null,
    $gross_weight_kg: doc.gross_weight_kg ?? null,
    $net_weight_kg: doc.net_weight_kg ?? null,
    $measurement_cbm: doc.measurement_cbm ?? null,
    $goods_description: doc.goods_description ?? null,
    $confidence_score: doc.confidence_score ?? 0.95,
    $notes: doc.notes ?? null,
    $created_at: createdAt,
    $updated_at: updatedAt,
  });
  stmt.free();

  // Insert Line Items
  if (doc.line_items && doc.line_items.length > 0) {
    logger.step("SQL_ITEMS", `Inserting ${doc.line_items.length} line item(s) into 'line_items' table`);
    const itemStmt = db.prepare(`
      INSERT INTO line_items (
        id, document_id, item_number, description, hs_code, quantity,
        unit_of_measure, unit_price, total_price, weight_kg, volume_cbm,
        package_type, package_count
      ) VALUES (
        $id, $document_id, $item_number, $description, $hs_code, $quantity,
        $unit_of_measure, $unit_price, $total_price, $weight_kg, $volume_cbm,
        $package_type, $package_count
      )
    `);

    for (let i = 0; i < doc.line_items.length; i++) {
      const item = doc.line_items[i];
      const itemId = item.id || `item_${docId}_${i + 1}`;
      itemStmt.run({
        $id: itemId,
        $document_id: docId,
        $item_number: item.item_number ?? `${i + 1}`,
        $description: item.description,
        $hs_code: item.hs_code ?? null,
        $quantity: item.quantity ?? null,
        $unit_of_measure: item.unit_of_measure ?? null,
        $unit_price: item.unit_price ?? null,
        $total_price: item.total_price ?? null,
        $weight_kg: item.weight_kg ?? null,
        $volume_cbm: item.volume_cbm ?? null,
        $package_type: item.package_type ?? null,
        $package_count: item.package_count ?? null,
      });
      logger.info("SQL_ITEM_ROW", `  [Item #${i + 1}] "${item.description}" | Qty: ${item.quantity ?? "N/A"} | Price: $${item.total_price ?? item.unit_price ?? 0}`);
    }
    itemStmt.free();
  }

  // Insert Container Details
  if (doc.containers && doc.containers.length > 0) {
    logger.step("SQL_CONTAINERS", `Inserting ${doc.containers.length} container record(s) into 'container_details' table`);
    const containerStmt = db.prepare(`
      INSERT INTO container_details (
        id, document_id, container_number, seal_number, container_type,
        gross_weight_kg, tare_weight_kg, net_weight_kg, measurement_cbm, packages_count
      ) VALUES (
        $id, $document_id, $container_number, $seal_number, $container_type,
        $gross_weight_kg, $tare_weight_kg, $net_weight_kg, $measurement_cbm, $packages_count
      )
    `);

    for (let i = 0; i < doc.containers.length; i++) {
      const container = doc.containers[i];
      const containerId = `cntr_${docId}_${i + 1}`;
      containerStmt.run({
        $id: containerId,
        $document_id: docId,
        $container_number: container.container_number,
        $seal_number: container.seal_number ?? null,
        $container_type: container.container_type ?? null,
        $gross_weight_kg: container.gross_weight_kg ?? null,
        $tare_weight_kg: container.tare_weight_kg ?? null,
        $net_weight_kg: container.net_weight_kg ?? null,
        $measurement_cbm: container.measurement_cbm ?? null,
        $packages_count: container.packages_count ?? null,
      });
      logger.info("SQL_CNTR_ROW", `  [Container #${i + 1}] ${container.container_number} (${container.container_type || "Std"}) | Seal: ${container.seal_number || "N/A"}`);
    }
    containerStmt.free();
  }

  saveDatabase();
  logger.success("SQL_COMMIT", `Database exported to disk: ${DB_FILE}`);

  const saved = await getShippingDocumentById(docId);
  return saved!;
}

export async function getAllShippingDocuments(filter?: {
  document_type?: string;
  status?: string;
  search?: string;
}): Promise<ShippingDocument[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM shipping_documents WHERE 1=1`;
  const params: any = {};

  if (filter?.document_type && filter.document_type !== "ALL") {
    query += ` AND document_type = $docType`;
    params.$docType = filter.document_type;
  }

  if (filter?.status && filter.status !== "ALL") {
    query += ` AND status = $status`;
    params.$status = filter.status;
  }

  if (filter?.search && filter.search.trim() !== "") {
    query += ` AND (
      file_name LIKE $search OR
      document_number LIKE $search OR
      invoice_number LIKE $search OR
      shipper_name LIKE $search OR
      consignee_name LIKE $search OR
      vessel_name LIKE $search OR
      goods_description LIKE $search
    )`;
    params.$search = `%${filter.search.trim()}%`;
  }

  query += ` ORDER BY created_at DESC`;

  const stmt = db.prepare(query);
  stmt.bind(params);

  const docs: ShippingDocument[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    const doc = mapRowToDocument(row);
    docs.push(doc);
  }
  stmt.free();

  // Attach line items and containers for each document
  for (const doc of docs) {
    const itemStmt = db.prepare(`SELECT * FROM line_items WHERE document_id = $id`);
    itemStmt.bind({ $id: doc.id });
    doc.line_items = [];
    while (itemStmt.step()) {
      doc.line_items.push(itemStmt.getAsObject() as any);
    }
    itemStmt.free();

    const containerStmt = db.prepare(`SELECT * FROM container_details WHERE document_id = $id`);
    containerStmt.bind({ $id: doc.id });
    doc.containers = [];
    while (containerStmt.step()) {
      doc.containers.push(containerStmt.getAsObject() as any);
    }
    containerStmt.free();
  }

  return docs;
}

export async function getShippingDocumentById(id: string): Promise<ShippingDocument | null> {
  const db = await getDatabase();
  const stmt = db.prepare(`SELECT * FROM shipping_documents WHERE id = $id`);
  stmt.bind({ $id: id });

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as any;
  stmt.free();

  const doc = mapRowToDocument(row);

  // Fetch line items
  const itemStmt = db.prepare(`SELECT * FROM line_items WHERE document_id = $id`);
  itemStmt.bind({ $id: id });
  doc.line_items = [];
  while (itemStmt.step()) {
    doc.line_items.push(itemStmt.getAsObject() as any);
  }
  itemStmt.free();

  // Fetch container details
  const containerStmt = db.prepare(`SELECT * FROM container_details WHERE document_id = $id`);
  containerStmt.bind({ $id: id });
  doc.containers = [];
  while (containerStmt.step()) {
    doc.containers.push(containerStmt.getAsObject() as any);
  }
  containerStmt.free();

  return doc;
}

export async function updateShippingDocument(id: string, updates: Partial<ShippingDocument>): Promise<ShippingDocument | null> {
  const existing = await getShippingDocumentById(id);
  if (!existing) return null;

  const db = await getDatabase();
  const updatedDoc = { ...existing, ...updates, updated_at: new Date().toISOString() };

  const stmt = db.prepare(`
    UPDATE shipping_documents SET
      file_name = $file_name,
      document_type = $document_type,
      status = $status,
      document_number = $document_number,
      invoice_number = $invoice_number,
      booking_number = $booking_number,
      reference_number = $reference_number,
      document_date = $document_date,
      due_date = $due_date,
      shipper_name = $shipper_name,
      shipper_address = $shipper_address,
      consignee_name = $consignee_name,
      consignee_address = $consignee_address,
      notify_party_name = $notify_party_name,
      notify_party_address = $notify_party_address,
      carrier_name = $carrier_name,
      freight_forwarder_name = $freight_forwarder_name,
      vessel_name = $vessel_name,
      voyage_number = $voyage_number,
      port_of_loading = $port_of_loading,
      port_of_discharge = $port_of_discharge,
      place_of_receipt = $place_of_receipt,
      place_of_delivery = $place_of_delivery,
      departure_date = $departure_date,
      arrival_date = $arrival_date,
      incoterms = $incoterms,
      payment_terms = $payment_terms,
      currency = $currency,
      subtotal_amount = $subtotal_amount,
      tax_amount = $tax_amount,
      freight_charges = $freight_charges,
      other_charges = $other_charges,
      total_amount = $total_amount,
      total_packages = $total_packages,
      package_type_summary = $package_type_summary,
      gross_weight_kg = $gross_weight_kg,
      net_weight_kg = $net_weight_kg,
      measurement_cbm = $measurement_cbm,
      goods_description = $goods_description,
      notes = $notes,
      updated_at = $updated_at
    WHERE id = $id
  `);

  stmt.run({
    $id: id,
    $file_name: updatedDoc.file_name,
    $document_type: updatedDoc.document_type,
    $status: updatedDoc.status,
    $document_number: updatedDoc.document_number ?? null,
    $invoice_number: updatedDoc.invoice_number ?? null,
    $booking_number: updatedDoc.booking_number ?? null,
    $reference_number: updatedDoc.reference_number ?? null,
    $document_date: updatedDoc.document_date ?? null,
    $due_date: updatedDoc.due_date ?? null,
    $shipper_name: updatedDoc.shipper_name ?? null,
    $shipper_address: updatedDoc.shipper_address ?? null,
    $consignee_name: updatedDoc.consignee_name ?? null,
    $consignee_address: updatedDoc.consignee_address ?? null,
    $notify_party_name: updatedDoc.notify_party_name ?? null,
    $notify_party_address: updatedDoc.notify_party_address ?? null,
    $carrier_name: updatedDoc.carrier_name ?? null,
    $freight_forwarder_name: updatedDoc.freight_forwarder_name ?? null,
    $vessel_name: updatedDoc.vessel_name ?? null,
    $voyage_number: updatedDoc.voyage_number ?? null,
    $port_of_loading: updatedDoc.port_of_loading ?? null,
    $port_of_discharge: updatedDoc.port_of_discharge ?? null,
    $place_of_receipt: updatedDoc.place_of_receipt ?? null,
    $place_of_delivery: updatedDoc.place_of_delivery ?? null,
    $departure_date: updatedDoc.departure_date ?? null,
    $arrival_date: updatedDoc.arrival_date ?? null,
    $incoterms: updatedDoc.incoterms ?? null,
    $payment_terms: updatedDoc.payment_terms ?? null,
    $currency: updatedDoc.currency ?? null,
    $subtotal_amount: updatedDoc.subtotal_amount ?? null,
    $tax_amount: updatedDoc.tax_amount ?? null,
    $freight_charges: updatedDoc.freight_charges ?? null,
    $other_charges: updatedDoc.other_charges ?? null,
    $total_amount: updatedDoc.total_amount ?? null,
    $total_packages: updatedDoc.total_packages ?? null,
    $package_type_summary: updatedDoc.package_type_summary ?? null,
    $gross_weight_kg: updatedDoc.gross_weight_kg ?? null,
    $net_weight_kg: updatedDoc.net_weight_kg ?? null,
    $measurement_cbm: updatedDoc.measurement_cbm ?? null,
    $goods_description: updatedDoc.goods_description ?? null,
    $notes: updatedDoc.notes ?? null,
    $updated_at: updatedDoc.updated_at,
  });
  stmt.free();

  // If line items updated
  if (updates.line_items !== undefined) {
    db.run(`DELETE FROM line_items WHERE document_id = '${id}'`);
    if (updates.line_items && updates.line_items.length > 0) {
      const itemStmt = db.prepare(`
        INSERT INTO line_items (
          id, document_id, item_number, description, hs_code, quantity,
          unit_of_measure, unit_price, total_price, weight_kg, volume_cbm,
          package_type, package_count
        ) VALUES (
          $id, $document_id, $item_number, $description, $hs_code, $quantity,
          $unit_of_measure, $unit_price, $total_price, $weight_kg, $volume_cbm,
          $package_type, $package_count
        )
      `);
      updates.line_items.forEach((item, idx) => {
        itemStmt.run({
          $id: item.id || `item_${id}_${idx + 1}`,
          $document_id: id,
          $item_number: item.item_number ?? `${idx + 1}`,
          $description: item.description,
          $hs_code: item.hs_code ?? null,
          $quantity: item.quantity ?? null,
          $unit_of_measure: item.unit_of_measure ?? null,
          $unit_price: item.unit_price ?? null,
          $total_price: item.total_price ?? null,
          $weight_kg: item.weight_kg ?? null,
          $volume_cbm: item.volume_cbm ?? null,
          $package_type: item.package_type ?? null,
          $package_count: item.package_count ?? null,
        });
      });
      itemStmt.free();
    }
  }

  // If containers updated
  if (updates.containers !== undefined) {
    db.run(`DELETE FROM container_details WHERE document_id = '${id}'`);
    if (updates.containers && updates.containers.length > 0) {
      const containerStmt = db.prepare(`
        INSERT INTO container_details (
          id, document_id, container_number, seal_number, container_type,
          gross_weight_kg, tare_weight_kg, net_weight_kg, measurement_cbm, packages_count
        ) VALUES (
          $id, $document_id, $container_number, $seal_number, $container_type,
          $gross_weight_kg, $tare_weight_kg, $net_weight_kg, $measurement_cbm, $packages_count
        )
      `);
      updates.containers.forEach((container, idx) => {
        containerStmt.run({
          $id: `cntr_${id}_${idx + 1}`,
          $document_id: id,
          $container_number: container.container_number,
          $seal_number: container.seal_number ?? null,
          $container_type: container.container_type ?? null,
          $gross_weight_kg: container.gross_weight_kg ?? null,
          $tare_weight_kg: container.tare_weight_kg ?? null,
          $net_weight_kg: container.net_weight_kg ?? null,
          $measurement_cbm: container.measurement_cbm ?? null,
          $packages_count: container.packages_count ?? null,
        });
      });
      containerStmt.free();
    }
  }

  saveDatabase();
  return await getShippingDocumentById(id);
}

export async function deleteShippingDocument(id: string): Promise<boolean> {
  const db = await getDatabase();
  db.run(`DELETE FROM line_items WHERE document_id = '${id}'`);
  db.run(`DELETE FROM container_details WHERE document_id = '${id}'`);
  db.run(`DELETE FROM shipping_documents WHERE id = '${id}'`);
  saveDatabase();
  return true;
}

export async function getDocumentStats(): Promise<{
  totalCount: number;
  totalValueUSD: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const db = await getDatabase();
  const docs = await getAllShippingDocuments();
  
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalValueUSD = 0;

  for (const doc of docs) {
    byType[doc.document_type] = (byType[doc.document_type] || 0) + 1;
    byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
    if (doc.total_amount && typeof doc.total_amount === "number") {
      totalValueUSD += doc.total_amount;
    }
  }

  return {
    totalCount: docs.length,
    totalValueUSD,
    byType,
    byStatus,
  };
}

function mapRowToDocument(row: any): ShippingDocument {
  return {
    id: row.id,
    file_name: row.file_name,
    file_size: row.file_size,
    file_type: row.file_type,
    raw_text: row.raw_text,
    document_type: row.document_type,
    status: row.status,
    document_number: row.document_number,
    invoice_number: row.invoice_number,
    booking_number: row.booking_number,
    reference_number: row.reference_number,
    document_date: row.document_date,
    due_date: row.due_date,
    shipper_name: row.shipper_name,
    shipper_address: row.shipper_address,
    consignee_name: row.consignee_name,
    consignee_address: row.consignee_address,
    notify_party_name: row.notify_party_name,
    notify_party_address: row.notify_party_address,
    carrier_name: row.carrier_name,
    freight_forwarder_name: row.freight_forwarder_name,
    vessel_name: row.vessel_name,
    voyage_number: row.voyage_number,
    port_of_loading: row.port_of_loading,
    port_of_discharge: row.port_of_discharge,
    place_of_receipt: row.place_of_receipt,
    place_of_delivery: row.place_of_delivery,
    departure_date: row.departure_date,
    arrival_date: row.arrival_date,
    incoterms: row.incoterms,
    payment_terms: row.payment_terms,
    currency: row.currency,
    subtotal_amount: row.subtotal_amount,
    tax_amount: row.tax_amount,
    freight_charges: row.freight_charges,
    other_charges: row.other_charges,
    total_amount: row.total_amount,
    total_packages: row.total_packages,
    package_type_summary: row.package_type_summary,
    gross_weight_kg: row.gross_weight_kg,
    net_weight_kg: row.net_weight_kg,
    measurement_cbm: row.measurement_cbm,
    goods_description: row.goods_description,
    confidence_score: row.confidence_score,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
