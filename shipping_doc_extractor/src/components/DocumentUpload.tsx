"use client";

import React, { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, Sparkles, Key } from "lucide-react";
import { ShippingDocument } from "@/types/document";

interface DocumentUploadProps {
  onDocumentProcessed: (doc: ShippingDocument) => void;
}

export default function DocumentUpload({ onDocumentProcessed }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type === "application/pdf" || selected.name.endsWith(".pdf")) {
        setFile(selected);
        setErrorMessage(null);
      } else {
        setErrorMessage("Please upload a PDF document.");
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (dropped.type === "application/pdf" || dropped.name.endsWith(".pdf")) {
        setFile(dropped);
        setErrorMessage(null);
      } else {
        setErrorMessage("Please drop a valid PDF document.");
      }
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Uploading PDF and analyzing structure with Google Gemini...");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("save_to_db", "true");
      if (apiKey.trim()) {
        formData.append("gemini_api_key", apiKey.trim());
      }

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process document with Gemini AI");
      }

      setUploadStatus("Document parsed and successfully saved to the database table.");
      setFile(null);
      if (json.saved_document) {
        onDocumentProcessed(json.saved_document);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during extraction.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-sky-600" />
            Upload Shipping Document or Invoice
          </h2>
          <p className="text-xs text-slate-500">
            Accepts Bills of Lading, Commercial Invoices, Freight Invoices, Packing Lists, Customs Declarations
          </p>
        </div>
        <button
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 px-2.5 py-1 rounded bg-slate-50"
        >
          <Key className="w-3.5 h-3.5" />
          {showApiKeyInput ? "Hide API Key Field" : "Custom Gemini Key"}
        </button>
      </div>

      {showApiKeyInput && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
          <label className="block font-medium text-slate-700">
            Gemini API Key (Optional if configured in .env):
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      )}

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-sky-500 bg-sky-50/50"
            : file
            ? "border-emerald-400 bg-emerald-50/30"
            : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
        }`}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          id="file-upload"
          onChange={handleFileChange}
          className="hidden"
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-emerald-600" />
              <div className="text-sm font-medium text-slate-800">{file.name}</div>
              <div className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB — Ready for Gemini analysis
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="w-10 h-10 text-slate-400" />
              <div className="text-sm font-medium text-slate-700">
                Click to browse or drag and drop a shipping PDF here
              </div>
              <div className="text-xs text-slate-500">
                Supports Bills of Lading, Commercial Invoices, Packing Lists (PDF up to 20MB)
              </div>
              <div className="mt-2 text-[11px] text-sky-700 bg-sky-50 px-3 py-1 rounded border border-sky-100 font-mono">
                Sample files available in /samples/sample_bill_of_lading.pdf & sample_commercial_invoice.pdf
              </div>
            </div>
          )}
        </label>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Uploading Status */}
      {uploadStatus && !errorMessage && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Automated extraction powered by Google Gemini Vision & LLM
        </div>
        <div className="flex gap-2">
          {file && (
            <button
              onClick={() => {
                setFile(null);
                setErrorMessage(null);
                setUploadStatus(null);
              }}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleProcess}
            disabled={!file || isUploading}
            className={`px-4 py-2 text-xs font-medium rounded flex items-center gap-2 text-white ${
              !file || isUploading
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-sky-700 hover:bg-sky-800"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Extracting & Storing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Process Document & Enter to DB
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
