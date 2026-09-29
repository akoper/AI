export type DocumentType =
  | "BILL_OF_LADING"
  | "COMMERCIAL_INVOICE"
  | "FREIGHT_INVOICE"
  | "PACKING_LIST"
  | "CUSTOMS_DECLARATION"
  | "DELIVERY_ORDER"
  | "SHIPPING_INSTRUCTION"
  | "OTHER";

export type DocumentStatus = "PROCESSED" | "REVIEWED" | "FLAGGED" | "ARCHIVED";

export interface LineItem {
  id?: string;
  item_number?: string;
  description: string;
  hs_code?: string;
  quantity?: number;
  unit_of_measure?: string;
  unit_price?: number;
  total_price?: number;
  weight_kg?: number;
  volume_cbm?: number;
  package_type?: string;
  package_count?: number;
}

export interface ContainerDetail {
  container_number: string;
  seal_number?: string;
  container_type?: string; // e.g., 20GP, 40HC, 45HQ, Reefer
  gross_weight_kg?: number;
  tare_weight_kg?: number;
  net_weight_kg?: number;
  measurement_cbm?: number;
  packages_count?: number;
}

export interface ShippingDocument {
  id: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  raw_text?: string;
  document_type: DocumentType;
  status: DocumentStatus;
  
  // Document identifiers
  document_number?: string; // B/L Number or Invoice Number or Reference Number
  invoice_number?: string;
  booking_number?: string;
  reference_number?: string;
  document_date?: string; // ISO format YYYY-MM-DD
  due_date?: string;

  // Parties involved
  shipper_name?: string;
  shipper_address?: string;
  consignee_name?: string;
  consignee_address?: string;
  notify_party_name?: string;
  notify_party_address?: string;
  carrier_name?: string;
  freight_forwarder_name?: string;

  // Logistics & Route
  vessel_name?: string;
  voyage_number?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  place_of_receipt?: string;
  place_of_delivery?: string;
  departure_date?: string;
  arrival_date?: string;

  // Financials & Commercial Terms
  incoterms?: string; // FOB, CIF, EXW, DDP, CFR, etc.
  payment_terms?: string; // Net 30, COD, LC, etc.
  currency?: string; // USD, EUR, GBP, CNY, etc.
  subtotal_amount?: number;
  tax_amount?: number;
  freight_charges?: number;
  other_charges?: number;
  total_amount?: number;

  // Cargo & Weight summary
  total_packages?: number;
  package_type_summary?: string;
  gross_weight_kg?: number;
  net_weight_kg?: number;
  measurement_cbm?: number;
  goods_description?: string;

  // Structured child details
  containers?: ContainerDetail[];
  line_items?: LineItem[];

  // Extraction metadata
  confidence_score?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractionResult {
  success: boolean;
  data?: Partial<ShippingDocument>;
  error?: string;
  raw_response?: string;
}
