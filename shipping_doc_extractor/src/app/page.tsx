"use client";

import React, { useEffect, useState, useCallback } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentTable from "@/components/DocumentTable";
import DocumentDetailModal from "@/components/DocumentDetailModal";
import StatsCards from "@/components/StatsCards";
import LiveActivityLogger from "@/components/LiveActivityLogger";
import { ShippingDocument } from "@/types/document";
import { RefreshCw, Database, Sparkles, FileSpreadsheet, PlusCircle } from "lucide-react";

export default function Home() {
  const [documents, setDocuments] = useState<ShippingDocument[]>([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalValueUSD: 0,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDocument, setSelectedDocument] = useState<ShippingDocument | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("document_type", filterType);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const res = await fetch(`/api/documents?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setDocuments(json.data || []);
        if (json.stats) {
          setStats(json.stats);
        }
      }
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setIsLoading(false);
    }
  }, [filterType, searchTerm]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDocumentProcessed = (newDoc: ShippingDocument) => {
    setSelectedDocument(newDoc);
    fetchDocuments();
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document from the database?")) return;

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        if (selectedDocument?.id === id) {
          setSelectedDocument(null);
        }
        fetchDocuments();
      }
    } catch (err) {
      console.error("Failed to delete document", err);
    }
  };

  const handleSavedUpdates = (updatedDoc: ShippingDocument) => {
    setSelectedDocument(updatedDoc);
    fetchDocuments();
  };

  // Seed sample data for shipping industry testing
  const handleSeedSampleData = async () => {
    try {
      const sampleDoc: ShippingDocument = {
        id: `doc_sample_${Date.now()}`,
        file_name: "MAERSK_OBL_784920184.pdf",
        file_size: 245120,
        file_type: "application/pdf",
        document_type: "BILL_OF_LADING",
        status: "PROCESSED",
        document_number: "MSK-OBL-784920184",
        booking_number: "BKG-2026-99120",
        reference_number: "SHP-EXP-55410",
        document_date: "2026-09-15",
        shipper_name: "Pacific Rim Logistics Corp",
        shipper_address: "88 Harbor Boulevard, Suite 400, Long Beach, CA 90802, USA",
        consignee_name: "Nippon Global Trading Ltd",
        consignee_address: "3-12-1 Ginza, Chuo-ku, Tokyo 104-0061, Japan",
        notify_party_name: "Yokohama Port Clearance Bureau",
        notify_party_address: "1-1 Kaigandori, Naka-ku, Yokohama 231-0002, Japan",
        carrier_name: "Maersk Line A/S",
        freight_forwarder_name: "Blue Water Forwarding Inc",
        vessel_name: "MAERSK MC-KINNEY MOLLER",
        voyage_number: "2609W",
        port_of_loading: "Port of Los Angeles (USLAX)",
        port_of_discharge: "Port of Yokohama (JPYOK)",
        place_of_receipt: "Long Beach Depot",
        place_of_delivery: "Tokyo CFS Terminal",
        departure_date: "2026-09-20",
        arrival_date: "2026-10-05",
        incoterms: "CIF",
        payment_terms: "Freight Prepaid",
        currency: "USD",
        subtotal_amount: 84500.0,
        tax_amount: 4225.0,
        freight_charges: 6800.0,
        other_charges: 1200.0,
        total_amount: 96725.0,
        total_packages: 1200,
        package_type_summary: "1,200 Cartons / 2x40' High Cube Containers",
        gross_weight_kg: 24850.0,
        net_weight_kg: 22400.0,
        measurement_cbm: 118.5,
        goods_description: "Industrial Precision Electric Motors and Assemblies",
        confidence_score: 0.98,
        notes: "Keep dry. Temperature controlled 18-22C. 14 days demurrage free time at POD.",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        containers: [
          {
            container_number: "MRKU8923012",
            seal_number: "MSK99102",
            container_type: "40HC",
            gross_weight_kg: 12450.0,
            tare_weight_kg: 3880.0,
            net_weight_kg: 11200.0,
            measurement_cbm: 59.2,
            packages_count: 600,
          },
          {
            container_number: "MSKU4491029",
            seal_number: "MSK99103",
            container_type: "40HC",
            gross_weight_kg: 12400.0,
            tare_weight_kg: 3880.0,
            net_weight_kg: 11200.0,
            measurement_cbm: 59.3,
            packages_count: 600,
          },
        ],
        line_items: [
          {
            item_number: "1",
            description: "High-Efficiency 3-Phase Industrial Electric Motors 5kW",
            hs_code: "8501.52.20",
            quantity: 800,
            unit_of_measure: "PCS",
            unit_price: 75.0,
            total_price: 60000.0,
            weight_kg: 16000.0,
            volume_cbm: 78.0,
            package_type: "Carton",
            package_count: 800,
          },
          {
            item_number: "2",
            description: "Solid State Motor Controllers & Variable Speed Inverters",
            hs_code: "8537.10.91",
            quantity: 400,
            unit_of_measure: "PCS",
            unit_price: 61.25,
            total_price: 24500.0,
            weight_kg: 6400.0,
            volume_cbm: 40.5,
            package_type: "Carton",
            package_count: 400,
          },
        ],
      };

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sampleDoc),
      });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error("Failed to seed sample record", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Shipping Documents & Invoices Database
          </h2>
          <p className="text-xs text-slate-500">
            Extract bills of lading, freight invoices, and commercial packing manifests directly into structured SQLite database tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedSampleData}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5 text-sky-600" />
            Load Sample Shipping Document
          </button>
          <button
            onClick={fetchDocuments}
            className="p-1.5 text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Analytics Overview Cards */}
      <StatsCards
        totalCount={stats.totalCount}
        totalValueUSD={stats.totalValueUSD}
        byType={stats.byType}
        byStatus={stats.byStatus}
      />

      {/* Gemini AI PDF Extractor & Upload Box */}
      <DocumentUpload onDocumentProcessed={handleDocumentProcessed} />

      {/* Real-time Activity and Terminal Logs View */}
      <LiveActivityLogger isProcessing={isLoading} />

      {/* Database Table View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-700" />
            Database Records (`shipping_documents` table)
          </h3>
        </div>

        <DocumentTable
          documents={documents}
          onSelectDocument={(doc) => setSelectedDocument(doc)}
          onDeleteDocument={handleDeleteDocument}
          selectedDocId={selectedDocument?.id}
          filterType={filterType}
          setFilterType={setFilterType}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </div>

      {/* Detail / Editing Modal */}
      {selectedDocument && (
        <DocumentDetailModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onSave={handleSavedUpdates}
        />
      )}
    </div>
  );
}
