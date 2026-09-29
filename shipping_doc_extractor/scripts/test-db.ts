import { getDatabase, insertShippingDocument, getAllShippingDocuments } from "../src/lib/db";
import { ShippingDocument } from "../src/types/document";

async function main() {
  console.log("[Test] Testing SQLite database initialization and operations...");

  const sampleDoc: ShippingDocument = {
    id: `doc_test_${Date.now()}`,
    file_name: "MEDITERRANEAN_SHIPPING_INV_9021.pdf",
    file_size: 154200,
    file_type: "application/pdf",
    document_type: "FREIGHT_INVOICE",
    status: "PROCESSED",
    document_number: "MSC-INV-2026-9021",
    invoice_number: "INV-9021-USA",
    booking_number: "MSC-BK-77192",
    document_date: "2026-09-20",
    shipper_name: "Trans-Atlantic Auto Parts Co.",
    shipper_address: "100 Industrial Parkway, Detroit, MI 48201, USA",
    consignee_name: "Rotterdam Distribution Hub B.V.",
    consignee_address: "Waalhaven Z.z. 10, 3089 JH Rotterdam, Netherlands",
    carrier_name: "MSC Mediterranean Shipping Company",
    vessel_name: "MSC GULSUN",
    voyage_number: "2638E",
    port_of_loading: "Port of New York / New Jersey (USNYC)",
    port_of_discharge: "Port of Rotterdam (NLRTM)",
    incoterms: "CIF",
    payment_terms: "Net 30 Days",
    currency: "USD",
    subtotal_amount: 14200.0,
    freight_charges: 12500.0,
    tax_amount: 710.0,
    other_charges: 990.0,
    total_amount: 14200.0,
    total_packages: 500,
    package_type_summary: "500 Wooden Crates / 1x40HC Container",
    gross_weight_kg: 18500.0,
    net_weight_kg: 16200.0,
    measurement_cbm: 68.4,
    goods_description: "Automotive Transmission Gears and Assemblies",
    confidence_score: 0.99,
    notes: "Direct ocean service. Clean on board.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    containers: [
      {
        container_number: "MEDU7749102",
        seal_number: "MSC09823",
        container_type: "40HC",
        gross_weight_kg: 18500.0,
        tare_weight_kg: 3900.0,
        net_weight_kg: 16200.0,
        measurement_cbm: 68.4,
        packages_count: 500,
      },
    ],
    line_items: [
      {
        item_number: "1",
        description: "Heavy-Duty Transmission Gearboxes for Commercial Vehicles",
        hs_code: "8708.40.11",
        quantity: 500,
        unit_of_measure: "UNITS",
        unit_price: 25.0,
        total_price: 12500.0,
        weight_kg: 16200.0,
        volume_cbm: 68.4,
        package_type: "Crate",
        package_count: 500,
      },
    ],
  };

  const inserted = await insertShippingDocument(sampleDoc);
  console.log(`[Test] Inserted document ID: ${inserted.id}, Document Number: ${inserted.document_number}`);

  const allDocs = await getAllShippingDocuments();
  console.log(`[Test] Total documents in database: ${allDocs.length}`);
  console.log(`[Test] Sample retrieved line items count: ${allDocs[0]?.line_items?.length || 0}`);
  console.log(`[Test] Sample retrieved containers count: ${allDocs[0]?.containers?.length || 0}`);

  if (allDocs.length > 0) {
    console.log("[Test] SUCCESS: Database table write and read verified!");
  } else {
    throw new Error("Verification failed: No documents returned");
  }
}

main().catch((err) => {
  console.error("[Test] Error:", err);
  process.exit(1);
});
