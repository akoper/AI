"use client";

import React from "react";
import { FileText, DollarSign, Layers, CheckCircle2 } from "lucide-react";

interface StatsCardsProps {
  totalCount: number;
  totalValueUSD: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export default function StatsCards({
  totalCount,
  totalValueUSD,
  byType,
  byStatus,
}: StatsCardsProps) {
  const formattedUSD = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(totalValueUSD);

  const billsOfLadingCount = byType["BILL_OF_LADING"] || 0;
  const invoicesCount = (byType["COMMERCIAL_INVOICE"] || 0) + (byType["FREIGHT_INVOICE"] || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Processed */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Documents
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Stored in SQLite</p>
        </div>
        <div className="p-3 bg-sky-50 text-sky-700 rounded-lg">
          <Layers className="w-5 h-5" />
        </div>
      </div>

      {/* Total Declared Invoice Value */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Value (USD)
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formattedUSD}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Cumulative cargo & freight</p>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
          <DollarSign className="w-5 h-5" />
        </div>
      </div>

      {/* Bills of Lading */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Bills of Lading
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{billsOfLadingCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ocean & multimodal B/Ls</p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
          <FileText className="w-5 h-5" />
        </div>
      </div>

      {/* Commercial & Freight Invoices */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Invoices Processed
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{invoicesCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Commercial & freight bills</p>
        </div>
        <div className="p-3 bg-purple-50 text-purple-700 rounded-lg">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
