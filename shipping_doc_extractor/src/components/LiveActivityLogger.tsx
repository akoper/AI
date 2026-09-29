"use client";

import React, { useEffect, useState, useRef } from "react";
import { Terminal, RefreshCw, Trash2, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Info, Play } from "lucide-react";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error" | "debug" | "step";
  stage: string;
  message: string;
  details?: any;
}

interface LiveActivityLoggerProps {
  isProcessing?: boolean;
}

export default function LiveActivityLogger({ isProcessing }: LiveActivityLoggerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch {
      // Ignore polling errors
    }
  };

  useEffect(() => {
    fetchLogs();
    // Poll logs every 1s when processing or every 3s when idle
    const interval = setInterval(fetchLogs, isProcessing ? 800 : 3000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs", { method: "DELETE" });
      setLogs([]);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === "all") return true;
    return log.level === filterLevel;
  });

  const getBadgeClass = (level: string) => {
    switch (level) {
      case "step":
        return "bg-blue-900/80 text-blue-200 border-blue-700";
      case "success":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-700";
      case "warn":
        return "bg-amber-950/80 text-amber-300 border-amber-700";
      case "error":
        return "bg-rose-950/80 text-rose-300 border-rose-700";
      case "info":
        return "bg-sky-950/80 text-sky-300 border-sky-800";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const getIcon = (level: string) => {
    switch (level) {
      case "step":
        return <Play className="w-3 h-3 text-blue-400 inline mr-1 fill-blue-400" />;
      case "success":
        return <CheckCircle className="w-3 h-3 text-emerald-400 inline mr-1" />;
      case "error":
        return <AlertCircle className="w-3 h-3 text-rose-400 inline mr-1" />;
      case "warn":
        return <AlertCircle className="w-3 h-3 text-amber-400 inline mr-1" />;
      default:
        return <Info className="w-3 h-3 text-sky-400 inline mr-1" />;
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg shadow-md overflow-hidden text-slate-200 font-mono text-xs">
      {/* Header bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-slate-100 text-sm">Real-time Terminal & Execution Log</span>
          {isProcessing && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
              Live Processing...
            </span>
          )}
          <span className="text-[11px] text-slate-400">({logs.length} entries)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-sky-500"
          >
            <option value="all">All Levels</option>
            <option value="step">Steps</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
            <option value="error">Errors</option>
          </select>

          <button
            onClick={fetchLogs}
            title="Refresh Logs"
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClearLogs}
            title="Clear Log History"
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      {isExpanded && (
        <div>
          <div
            ref={scrollContainerRef}
            className="p-3 max-h-72 overflow-y-auto space-y-1.5 bg-slate-950/95 scrollbar-thin scrollbar-thumb-slate-700 select-text"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 italic">
                No logs recorded yet. Upload a shipping invoice or document to see live step-by-step progress.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const timeString = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <div
                    key={log.id}
                    className="flex flex-col gap-0.5 border-b border-slate-900/60 pb-1 hover:bg-slate-900/40 px-1 rounded transition"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-slate-400 text-[10px] tabular-nums shrink-0">{timeString}</span>
                      <span
                        className={`text-[9.5px] uppercase font-bold px-1.5 py-0.2 rounded border shrink-0 ${getBadgeClass(
                          log.level
                        )}`}
                      >
                        {getIcon(log.level)}
                        {log.level}
                      </span>
                      {log.stage && (
                        <span className="text-pink-400/90 text-[11px] font-semibold shrink-0">
                          [{log.stage}]
                        </span>
                      )}
                      <span className="text-slate-200 break-words flex-1 text-[11.5px]">{log.message}</span>
                    </div>

                    {/* Expandable details if present */}
                    {log.details && (
                      <div className="ml-16 pl-2 border-l border-slate-700/60 my-0.5">
                        <pre className="text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap leading-tight">
                          {typeof log.details === "object"
                            ? JSON.stringify(log.details, null, 2)
                            : String(log.details)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-slate-900/90 border-t border-slate-800 px-3 py-1 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Terminal & Console Logs Synchronized</span>
            </div>
            <label className="flex items-center gap-1 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-sky-500 w-3 h-3"
              />
              Auto-scroll
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
