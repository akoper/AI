"use client";

import React from "react";
import {
  FileText,
  DollarSign,
  Layers,
  Clock,
  Search,
  Filter,
  Trash2,
  Eye,
  CheckCircle2,
  Calendar,
  Anchor,
  Box,
} from "lucide-react";
import { ShippingDocument, DocumentType } from "@/types/document";

interface DocumentTableProps {
  documents: ShippingDocument[];
  onSelectDocument: (doc: ShippingDocument) => void;
  onDeleteDocument: (id: string) => void;
  selectedDocId?: string | null;
  filterType: string;
  setFilterType: (type: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType | "ALL", string> = {
  ALL: "All Document Types",
  BILL_OF_LADING: "Bill of Lading (B/L)",
  COMMERCIAL_INVOICE: "Commercial Invoice",
  FREIGHT_INVOICE: "Freight Invoice",
  PACKING_LIST: "Packing List",
  CUSTOMS_DECLARATION: "Customs Declaration",
  DELIVERY_ORDER: "Delivery Order",
  SHIPPING_INSTRUCTION: "Shipping Instruction",
  OTHER: "Other Logistics Doc",
};

export default function DocumentTable({
  documents,
  onSelectDocument,
  onDeleteDocument,
  selectedDocId,
  filterType,
  setFilterType,
  searchTerm,
  setSearchTerm,
}: DocumentTableProps) {
  const formatCurrency = (amount?: number, curr = "USD") => {
    if (amount === undefined || amount === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr || "USD",
    }).format(amount);
  };

  const getTypeBadge = (type: DocumentType) => {
    switch (type) {
      case "BILL_OF_LADING":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "COMMERCIAL_INVOICE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "FREIGHT_INVOICE":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "PACKING_LIST":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "CUSTOMS_DECLARATION":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Controls Header */}
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/50">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by doc #, shipper, consignee, vessel..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 text-slate-700"
          >
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/75 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Doc Type & Reference</th>
              <th className="py-3 px-4">Shipper / Exporter</th>
              <th className="py-3 px-4">Consignee / Importer</th>
              <th className="py-3 px-4">Route & Vessel</th>
              <th className="py-3 px-4">Cargo / Total</th>
              <th className="py-3 px-4">Status & Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Layers className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-medium">No shipping documents found in database</p>
                    <p className="text-xs text-slate-400">
                      Upload a PDF invoice or Bill of Lading above to extract and enter data automatically.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                return (
                  <tr
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                      isSelected ? "bg-sky-50/70 border-l-4 border-l-sky-600" : ""
                    }`}
                  >
                    {/* Doc Type & Number */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border w-fit ${getTypeBadge(
                            doc.document_type
                          )}`}
                        >
                          {doc.document_type.replace(/_/g, " ")}
                        </span>
                        <span className="font-semibold text-slate-900 truncate max-w-[160px]">
                          {doc.document_number || doc.invoice_number || doc.booking_number || doc.file_name}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          File: {doc.file_name}
                        </span>
                      </div>
                    </td>

                    {/* Shipper */}
                    <td className="py-3 px-4">
                      <div className="max-w-[160px]">
                        <div className="font-medium text-slate-800 truncate">
                          {doc.shipper_name || "—"}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {doc.shipper_address || ""}
                        </div>
                      </div>
                    </td>

                    {/* Consignee */}
                    <td className="py-3 px-4">
                      <div className="max-w-[160px]">
                        <div className="font-medium text-slate-800 truncate">
                          {doc.consignee_name || "—"}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {doc.consignee_address || ""}
                        </div>
                      </div>
                    </td>

                    {/* Route & Vessel */}
                    <td className="py-3 px-4">
                      <div className="max-w-[170px] text-[11px] space-y-0.5">
                        {doc.vessel_name && (
                          <div className="flex items-center gap-1 text-slate-700 truncate">
                            <Anchor className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="font-medium truncate">{doc.vessel_name}</span>
                            {doc.voyage_number && <span>({doc.voyage_number})</span>}
                          </div>
                        )}
                        {(doc.port_of_loading || doc.port_of_discharge) && (
                          <div className="text-slate-500 text-[10px] truncate">
                            {doc.port_of_loading || "?"} &rarr; {doc.port_of_discharge || "?"}
                          </div>
                        )}
                        {!doc.vessel_name && !doc.port_of_loading && <span className="text-slate-400">—</span>}
                      </div>
                    </td>

                    {/* Cargo / Total */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {doc.total_amount ? (
                          <div className="font-semibold text-emerald-700">
                            {formatCurrency(doc.total_amount, doc.currency)}
                          </div>
                        ) : null}
                        {doc.gross_weight_kg ? (
                          <div className="text-[10px] text-slate-600">
                            {doc.gross_weight_kg.toLocaleString()} kg
                          </div>
                        ) : null}
                        {doc.package_type_summary ? (
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {doc.package_type_summary}
                          </div>
                        ) : null}
                        {!doc.total_amount && !doc.gross_weight_kg && !doc.package_type_summary && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status & Date */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {doc.status}
                        </span>
                        {doc.document_date && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {doc.document_date}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectDocument(doc)}
                          title="View Details & Edit"
                          className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteDocument(doc.id)}
                          title="Delete from Database"
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stats */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <span>Showing {documents.length} recorded documents</span>
        <span>All records stored locally in SQLite</span>
      </div>
    </div>
  );
}
