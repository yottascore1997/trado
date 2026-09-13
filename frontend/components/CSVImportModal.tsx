"use client";

import React, { useState } from "react";
import { X, UploadCloud, CheckCircle, AlertCircle, FileText, Loader2 } from "lucide-react";

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState("NIFTY 50");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Direct API upload or mock fallback if backend offline
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`http://localhost:8000/api/v1/market/upload-csv?symbol=${encodeURIComponent(symbol)}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "CSV upload failed");
      }

      const data = await res.json();
      setResult(data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      // Simulate client-side validation summary for demo if backend is starting
      setError(err.message || "Failed to upload and validate CSV.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">Historical 1-Minute CSV Ingestion</h3>
            <p className="text-xs text-slate-400">NSE Market Hours Validation (09:15 to 15:30 IST)</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Instrument Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5 font-mono">Target Instrument</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="NIFTY 50">NIFTY 50 (Index)</option>
              <option value="BANK NIFTY">BANK NIFTY (Index)</option>
            </select>
          </div>

          {/* File input box */}
          <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-6 text-center bg-slate-950/40">
            <input
              type="file"
              accept=".csv"
              id="csv-file-input"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <span className="text-slate-300 font-medium block">
                {selectedFile ? selectedFile.name : "Click to select 1-minute CSV file"}
              </span>
              <span className="text-slate-500 text-[11px] block mt-1">
                Required columns: timestamp, open, high, low, close, volume, instrument
              </span>
            </label>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Result Summary */}
          {result && (
            <div className="p-3 rounded bg-emerald-950/30 border border-emerald-800/50 space-y-1.5 font-mono">
              <div className="flex items-center text-emerald-400 font-bold">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                <span>Validation & Ingestion {result.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-300">
                <div>Total Rows: <strong className="text-slate-100">{result.total_rows}</strong></div>
                <div>Imported: <strong className="text-emerald-400">{result.valid_rows}</strong></div>
                <div>Duplicates: <strong className="text-amber-400">{result.duplicate_rows}</strong></div>
                <div>Invalid / Gaps: <strong className="text-rose-400">{result.invalid_rows}</strong></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !selectedFile}
              className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium flex items-center space-x-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? "Validating & Ingesting..." : "Validate & Import"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
