"use client";

import React, { useState } from "react";
import {
  X,
  Save,
  CheckCircle2,
  Trash2,
  Plus,
  FileText,
  DollarSign,
  Truck,
  Anchor,
  Box,
  Layers,
  MapPin,
  Building,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ShippingDocument, LineItem, ContainerDetail, DocumentType, DocumentStatus } from "@/types/document";

interface DocumentDetailModalProps {
  document: ShippingDocument;
  onClose: () => void;
  onSave: (updated: ShippingDocument) => void;
}

export default function DocumentDetailModal({
  document,
  onClose,
  onSave,
}: DocumentDetailModalProps) {
  const [formData, setFormData] = useState<ShippingDocument>({
    ...document,
    line_items: document.line_items || [],
    containers: document.containers || [],
  });
  const [activeTab, setActiveTab] = useState<"general" | "parties" | "logistics" | "cargo" | "financials">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = (field: keyof ShippingDocument, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...(formData.line_items || [])];
    updated[index] = { ...updated[index], [field]: value };
    // Recalculate total if unit_price and quantity changed
    if (field === "quantity" || field === "unit_price") {
      const q = field === "quantity" ? Number(value) : Number(updated[index].quantity || 0);
      const p = field === "unit_price" ? Number(value) : Number(updated[index].unit_price || 0);
      if (!isNaN(q) && !isNaN(p)) {
        updated[index].total_price = Number((q * p).toFixed(2));
      }
    }
    setFormData((prev) => ({ ...prev, line_items: updated }));
  };

  const handleAddLineItem = () => {
    const newItem: LineItem = {
      description: "New cargo item",
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    };
    setFormData((prev) => ({
      ...prev,
      line_items: [...(prev.line_items || []), newItem],
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      line_items: (prev.line_items || []).filter((_, i) => i !== index),
    }));
  };

  const handleContainerChange = (index: number, field: keyof ContainerDetail, value: any) => {
    const updated = [...(formData.containers || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, containers: updated }));
  };

  const handleAddContainer = () => {
    const newContainer: ContainerDetail = {
      container_number: "MSCU1234567",
      container_type: "40HC",
    };
    setFormData((prev) => ({
      ...prev,
      containers: [...(prev.containers || []), newContainer],
    }));
  };

  const handleRemoveContainer = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      containers: (prev.containers || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/documents/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save document updates");
      }

      setSaveSuccess(true);
      onSave(json.data);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                {formData.document_type}
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                {formData.document_number || formData.invoice_number || formData.file_name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Source file: {formData.file_name} • Extracted with Google Gemini
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-medium">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 ${
              activeTab === "general"
                ? "border-sky-600 text-sky-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            General & Status
          </button>
          <button
            onClick={() => setActiveTab("parties")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 ${
              activeTab === "parties"
                ? "border-sky-600 text-sky-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-4 h-4" />
            Shipper & Consignee
          </button>
          <button
            onClick={() => setActiveTab("logistics")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 ${
              activeTab === "logistics"
                ? "border-sky-600 text-sky-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Anchor className="w-4 h-4" />
            Logistics & Route
          </button>
          <button
            onClick={() => setActiveTab("cargo")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 ${
              activeTab === "cargo"
                ? "border-sky-600 text-sky-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Box className="w-4 h-4" />
            Line Items & Containers ({(formData.line_items?.length || 0) + (formData.containers?.length || 0)})
          </button>
          <button
            onClick={() => setActiveTab("financials")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 ${
              activeTab === "financials"
                ? "border-sky-600 text-sky-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Commercial & Financials
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-slate-50/30">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: General & Status */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Document Type</label>
                <select
                  value={formData.document_type}
                  onChange={(e) => handleInputChange("document_type", e.target.value as DocumentType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                >
                  <option value="BILL_OF_LADING">Bill of Lading</option>
                  <option value="COMMERCIAL_INVOICE">Commercial Invoice</option>
                  <option value="FREIGHT_INVOICE">Freight Invoice</option>
                  <option value="PACKING_LIST">Packing List</option>
                  <option value="CUSTOMS_DECLARATION">Customs Declaration</option>
                  <option value="DELIVERY_ORDER">Delivery Order</option>
                  <option value="SHIPPING_INSTRUCTION">Shipping Instruction</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Database Record Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange("status", e.target.value as DocumentStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                >
                  <option value="PROCESSED">Processed</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="FLAGGED">Flagged</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Document Number / B/L Number</label>
                <input
                  type="text"
                  value={formData.document_number || ""}
                  onChange={(e) => handleInputChange("document_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Invoice Number</label>
                <input
                  type="text"
                  value={formData.invoice_number || ""}
                  onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Booking / Ref Number</label>
                <input
                  type="text"
                  value={formData.booking_number || formData.reference_number || ""}
                  onChange={(e) => handleInputChange("booking_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Document Date</label>
                <input
                  type="date"
                  value={formData.document_date || ""}
                  onChange={(e) => handleInputChange("document_date", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700">Special Notes & Instructions</label>
                <textarea
                  rows={3}
                  value={formData.notes || ""}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Demurrage terms, temperature settings, customs handling notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Parties */}
          {activeTab === "parties" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 bg-white p-4 border border-slate-200 rounded">
                <h4 className="font-semibold text-slate-900 border-b pb-1">Shipper / Exporter</h4>
                <div className="space-y-1">
                  <label className="text-slate-600">Company Name</label>
                  <input
                    type="text"
                    value={formData.shipper_name || ""}
                    onChange={(e) => handleInputChange("shipper_name", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600">Address</label>
                  <textarea
                    rows={2}
                    value={formData.shipper_address || ""}
                    onChange={(e) => handleInputChange("shipper_address", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="space-y-3 bg-white p-4 border border-slate-200 rounded">
                <h4 className="font-semibold text-slate-900 border-b pb-1">Consignee / Receiver</h4>
                <div className="space-y-1">
                  <label className="text-slate-600">Company Name</label>
                  <input
                    type="text"
                    value={formData.consignee_name || ""}
                    onChange={(e) => handleInputChange("consignee_name", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600">Address</label>
                  <textarea
                    rows={2}
                    value={formData.consignee_address || ""}
                    onChange={(e) => handleInputChange("consignee_address", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="space-y-3 bg-white p-4 border border-slate-200 rounded">
                <h4 className="font-semibold text-slate-900 border-b pb-1">Notify Party</h4>
                <div className="space-y-1">
                  <label className="text-slate-600">Company Name</label>
                  <input
                    type="text"
                    value={formData.notify_party_name || ""}
                    onChange={(e) => handleInputChange("notify_party_name", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600">Address</label>
                  <textarea
                    rows={2}
                    value={formData.notify_party_address || ""}
                    onChange={(e) => handleInputChange("notify_party_address", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="space-y-3 bg-white p-4 border border-slate-200 rounded">
                <h4 className="font-semibold text-slate-900 border-b pb-1">Carrier & Forwarder</h4>
                <div className="space-y-1">
                  <label className="text-slate-600">Carrier / Shipping Line</label>
                  <input
                    type="text"
                    value={formData.carrier_name || ""}
                    onChange={(e) => handleInputChange("carrier_name", e.target.value)}
                    placeholder="e.g., Maersk, MSC, CMA CGM, Hapag-Lloyd"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-600">Freight Forwarder</label>
                  <input
                    type="text"
                    value={formData.freight_forwarder_name || ""}
                    onChange={(e) => handleInputChange("freight_forwarder_name", e.target.value)}
                    placeholder="e.g., Kuehne+Nagel, DSV, Expeditors"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Logistics & Route */}
          {activeTab === "logistics" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Vessel Name</label>
                <input
                  type="text"
                  value={formData.vessel_name || ""}
                  onChange={(e) => handleInputChange("vessel_name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Voyage / Flight Number</label>
                <input
                  type="text"
                  value={formData.voyage_number || ""}
                  onChange={(e) => handleInputChange("voyage_number", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Port of Loading (POL)</label>
                <input
                  type="text"
                  value={formData.port_of_loading || ""}
                  onChange={(e) => handleInputChange("port_of_loading", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Port of Discharge (POD)</label>
                <input
                  type="text"
                  value={formData.port_of_discharge || ""}
                  onChange={(e) => handleInputChange("port_of_discharge", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Place of Receipt</label>
                <input
                  type="text"
                  value={formData.place_of_receipt || ""}
                  onChange={(e) => handleInputChange("place_of_receipt", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Place of Delivery / Final Destination</label>
                <input
                  type="text"
                  value={formData.place_of_delivery || ""}
                  onChange={(e) => handleInputChange("place_of_delivery", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Estimated Departure Date</label>
                <input
                  type="date"
                  value={formData.departure_date || ""}
                  onChange={(e) => handleInputChange("departure_date", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Estimated Arrival Date</label>
                <input
                  type="date"
                  value={formData.arrival_date || ""}
                  onChange={(e) => handleInputChange("arrival_date", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Cargo & Line Items */}
          {activeTab === "cargo" && (
            <div className="space-y-6">
              {/* Overall Cargo Summary */}
              <div className="bg-white p-4 border border-slate-200 rounded grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-slate-600 block">Total Packages</label>
                  <input
                    type="number"
                    value={formData.total_packages || ""}
                    onChange={(e) => handleInputChange("total_packages", Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block">Package Type Summary</label>
                  <input
                    type="text"
                    value={formData.package_type_summary || ""}
                    onChange={(e) => handleInputChange("package_type_summary", e.target.value)}
                    placeholder="e.g. 50 Cartons, 2 Pallets"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block">Gross Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.gross_weight_kg || ""}
                    onChange={(e) => handleInputChange("gross_weight_kg", Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block">Volume (CBM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.measurement_cbm || ""}
                    onChange={(e) => handleInputChange("measurement_cbm", Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded mt-1"
                  />
                </div>
              </div>

              {/* Containers Table */}
              <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-600" />
                    Containers & Equipment ({formData.containers?.length || 0})
                  </h4>
                  <button
                    onClick={handleAddContainer}
                    className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Container
                  </button>
                </div>

                {formData.containers && formData.containers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-600 font-semibold text-[11px]">
                          <th className="py-2 px-2">Container Number</th>
                          <th className="py-2 px-2">Seal Number</th>
                          <th className="py-2 px-2">Type / Size</th>
                          <th className="py-2 px-2">Gross Wt (kg)</th>
                          <th className="py-2 px-2">Volume (CBM)</th>
                          <th className="py-2 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.containers.map((cntr, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={cntr.container_number}
                                onChange={(e) => handleContainerChange(idx, "container_number", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={cntr.seal_number || ""}
                                onChange={(e) => handleContainerChange(idx, "seal_number", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={cntr.container_type || ""}
                                onChange={(e) => handleContainerChange(idx, "container_type", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                step="0.01"
                                value={cntr.gross_weight_kg || ""}
                                onChange={(e) => handleContainerChange(idx, "gross_weight_kg", Number(e.target.value))}
                                className="w-24 px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                step="0.01"
                                value={cntr.measurement_cbm || ""}
                                onChange={(e) => handleContainerChange(idx, "measurement_cbm", Number(e.target.value))}
                                className="w-20 px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                onClick={() => handleRemoveContainer(idx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-2">No container records.</p>
                )}
              </div>

              {/* Line Items Table */}
              <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Box className="w-4 h-4 text-emerald-600" />
                    Commercial Line Items & Cargo ({formData.line_items?.length || 0})
                  </h4>
                  <button
                    onClick={handleAddLineItem}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line Item
                  </button>
                </div>

                {formData.line_items && formData.line_items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-600 font-semibold text-[11px]">
                          <th className="py-2 px-2">Description</th>
                          <th className="py-2 px-2">HS Code</th>
                          <th className="py-2 px-2">Qty</th>
                          <th className="py-2 px-2">Unit</th>
                          <th className="py-2 px-2">Unit Price</th>
                          <th className="py-2 px-2">Total Price</th>
                          <th className="py-2 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.line_items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-2 min-w-[200px]">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 w-28">
                              <input
                                type="text"
                                value={item.hs_code || ""}
                                onChange={(e) => handleLineItemChange(idx, "hs_code", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={item.quantity || ""}
                                onChange={(e) => handleLineItemChange(idx, "quantity", Number(e.target.value))}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 w-20">
                              <input
                                type="text"
                                value={item.unit_of_measure || ""}
                                onChange={(e) => handleLineItemChange(idx, "unit_of_measure", e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 w-24">
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price || ""}
                                onChange={(e) => handleLineItemChange(idx, "unit_price", Number(e.target.value))}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 w-28">
                              <input
                                type="number"
                                step="0.01"
                                value={item.total_price || ""}
                                onChange={(e) => handleLineItemChange(idx, "total_price", Number(e.target.value))}
                                className="w-full px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                onClick={() => handleRemoveLineItem(idx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-2">No line items extracted.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Commercial & Financials */}
          {activeTab === "financials" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Incoterms</label>
                <select
                  value={formData.incoterms || ""}
                  onChange={(e) => handleInputChange("incoterms", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  <option value="">Select Incoterm</option>
                  <option value="FOB">FOB - Free on Board</option>
                  <option value="CIF">CIF - Cost, Insurance & Freight</option>
                  <option value="CFR">CFR - Cost & Freight</option>
                  <option value="EXW">EXW - Ex Works</option>
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                  <option value="DAP">DAP - Delivered at Place</option>
                  <option value="FCA">FCA - Free Carrier</option>
                  <option value="CIP">CIP - Carriage & Insurance Paid</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Currency</label>
                <input
                  type="text"
                  value={formData.currency || "USD"}
                  onChange={(e) => handleInputChange("currency", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms || ""}
                  onChange={(e) => handleInputChange("payment_terms", e.target.value)}
                  placeholder="e.g. Net 30 days, LC 60 days, Prepaid"
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Subtotal Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.subtotal_amount || ""}
                  onChange={(e) => handleInputChange("subtotal_amount", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Freight Charges</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.freight_charges || ""}
                  onChange={(e) => handleInputChange("freight_charges", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tax / Customs / Duties Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.tax_amount || ""}
                  onChange={(e) => handleInputChange("tax_amount", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Other Surcharges (BAF/CAF/THC)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.other_charges || ""}
                  onChange={(e) => handleInputChange("other_charges", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 text-emerald-800">Total Invoice Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_amount || ""}
                  onChange={(e) => handleInputChange("total_amount", Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-400 bg-emerald-50/40 rounded font-bold text-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {saveSuccess && (
              <span className="text-emerald-700 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Database table successfully updated!
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded text-xs font-medium flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save & Update Database
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
