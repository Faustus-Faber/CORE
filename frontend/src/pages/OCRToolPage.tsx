import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getOCRHistory,
  getOCRScan,
  OCRItem,
  OCRScan,
  updateOCRItem,
  uploadOCRImage
} from "../services/api";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "/api").replace("/api", "") || "";
const CATEGORIES = ["License Plate", "Street Address", "Warning Label", "Sign", "General Text"];

// Helper to parse the combined AI + OCR text from the backend
function parseCombinedText(rawText: string) {
  if (rawText.includes("--- AI SCENARIO SUMMARY ---")) {
    const parts = rawText.split("--- RAW EXTRACTED TEXT ---");
    const aiPart = parts[0].replace("--- AI SCENARIO SUMMARY ---", "").trim();
    const rawPart = parts[1] ? parts[1].trim() : "";
    return { aiSummary: aiPart, rawExtracted: rawPart };
  }
  return { aiSummary: null, rawExtracted: rawText };
}

export function OCRToolPage() {
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeScan, setActiveScan] = useState<OCRScan | null>(null);
  const [history, setHistory] = useState<OCRScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [aiConsent, setAiConsent] = useState(true);

  const refreshHistory = async () => {
    setLoading(true);
    try {
      const data = await getOCRHistory(1, 20);
      const scans = Array.isArray(data.scans) ? data.scans : [];
      setHistory(scans);
      setActiveScan((current) => current ?? scans[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load OCR history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshHistory();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const scanId = (location.state as { scanId?: string } | null)?.scanId;
    if (!scanId) return;

    getOCRScan(scanId)
      .then((response) => { if (!cancelled && response?.scan) setActiveScan(response.scan); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load OCR scan"); });
    return () => { cancelled = true; };
  }, [location.state]);

  const handleScan = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("OCR image must be 10MB or less.");
      return;
    }

    setScanning(true);
    setError("");
    try {
      const { scan } = await uploadOCRImage({ image: selectedFile, aiConsent });
      setActiveScan(scan);
      setHistory((current) => [scan, ...current.filter((item) => item.id !== scan.id)]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleItemUpdated = (item: OCRItem) => {
    setActiveScan((scan) => updateScanItem(scan, item));
    setHistory((scans) => scans.map((scan) => updateScanItem(scan, item) ?? scan));
  };

  return (
    <div className="space-y-6">
      
      {/* ── 1. Signature Header Card Box ────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-tide">Secure Documentation</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink font-display">AI & OCR Scan Tool</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Analyze disaster scenes with Gemini AI and extract readable text for documentation or NGO report appendices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-tide px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tide/90 flex-shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Select Image</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-xs">
          {error}
        </div>
      )}

      {/* ── 2. Grid Workspace Layout ───────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        
        {/* Left Sidebar Controls */}
        <aside className="space-y-4">
          
          {/* Upload Card */}
          <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center cursor-pointer transition hover:bg-slate-100/70 hover:border-tide/50"
            >
              <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-xs font-semibold text-ink">
                {selectedFile ? selectedFile.name : "No image selected"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">JPG, PNG, WEBP up to 10MB</p>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={(e) => setAiConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-tide focus:ring-tide"
              />
              <span>I consent to sending this image to a third-party AI provider for analysis.</span>
            </label>

            <button
              type="button"
              disabled={!selectedFile || scanning || !aiConsent}
              onClick={() => void handleScan()}
              className="w-full rounded-lg bg-tide px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tide/90 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scanning ? (
                "Analyzing Image..."
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Scan with AI</span>
                </>
              )}
            </button>
          </div>

          {/* Scan History Card */}
          <div className="rounded-xl border border-[#0e7490]/30 bg-white p-5 shadow-panel ring-1 ring-[#0e7490]/20 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Scan History</h2>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="text-xs font-semibold text-tide hover:underline"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-400">Loading scans...</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No scans yet.</p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {history.map((scan) => {
                  const isSelected = activeScan?.id === scan.id;
                  return (
                    <button
                      key={scan.id}
                      type="button"
                      onClick={() => setActiveScan(scan)}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? "border-[#0e7490]/80 bg-tide/5 ring-1 ring-[#0e7490]/40 shadow-md text-tide font-semibold"
                          : "border-[#0e7490]/30 bg-white ring-1 ring-[#0e7490]/20 hover:border-[#0e7490]/60 hover:ring-[#0e7490]/30 shadow-xs text-ink"
                      }`}
                    >
                      <p className="truncate text-xs font-bold">{scan.sourceFileName}</p>
                      <p className="mt-1 text-[11px] text-slate-500 font-normal">
                        {scan.items.length} items · {new Date(scan.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </aside>

        {/* Right Main Analysis Card */}
        <section className="rounded-xl border border-[#0e7490]/30 bg-white p-6 shadow-panel ring-1 ring-[#0e7490]/20">
          {activeScan ? (
            <OCRScanDetails scan={activeScan} onItemUpdated={handleItemUpdated} />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              Select an existing scan from history or upload a new image to view AI analysis and extracted text.
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function OCRScanDetails({
  scan,
  onItemUpdated
}: {
  scan: OCRScan;
  onItemUpdated: (item: OCRItem) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftCategory, setDraftCategory] = useState("General Text");
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [saveError, setSaveError] = useState("");

  const { aiSummary } = parseCombinedText(scan.rawText);

  const startEditing = (item: OCRItem) => {
    setEditingId(item.id);
    setDraftText(item.text);
    setDraftCategory(item.category);
  };

  const saveItem = async (item: OCRItem) => {
    try {
      setSaveError("");
      const { item: updated } = await updateOCRItem(scan.id, item.id, {
        text: draftText,
        category: draftCategory
      });
      onItemUpdated(updated);
      setEditingId(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save item");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink font-display">{scan.sourceFileName}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Provider: {scan.provider} · Created {new Date(scan.createdAt).toLocaleString()}
          </p>
          {scan.folder && <p className="mt-1 text-xs font-semibold text-tide">Folder: {scan.folder.name}</p>}
        </div>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(scan.rawText)}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          Copy All Data
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        
        {/* Source Image Frame */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 h-fit">
          <img
            src={`${API_ORIGIN}${scan.sourceImageUrl}`}
            alt={scan.sourceFileName}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              setImageSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight
              });
            }}
            className="max-h-[520px] w-full object-contain"
          />
          {imageSize && scan.items.map((item) => (
            <OCRBoxOverlay key={item.id} item={item} imageSize={imageSize} />
          ))}
        </div>

        {/* Extracted Details & AI Summary */}
        <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">

          {/* AI Scenario Summary Box */}
          {aiSummary && (
            <div className="rounded-xl border border-[#0e7490]/30 bg-tide/5 p-4 shadow-sm space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-tide">
                <svg className="w-4 h-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI Scenario Summary</span>
              </h3>
              <div className="text-xs text-slate-800 leading-relaxed prose prose-xs max-w-none prose-headings:text-ink prose-strong:text-ink prose-p:my-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {aiSummary}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Extracted Text Items */}
          <div>
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              OCR Extracted Text
            </h3>
            {scan.items.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500 border border-slate-100">No readable text was detected.</p>
            ) : (
              <div className="space-y-2.5">
                {scan.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={draftText}
                          onChange={(event) => setDraftText(event.target.value)}
                          className="w-full rounded-md border border-slate-300 p-2 text-xs text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                          rows={2}
                        />
                        <select
                          value={draftCategory}
                          onChange={(event) => setDraftCategory(event.target.value)}
                          className="w-full rounded-md border border-slate-300 p-2 text-xs text-ink focus:border-tide focus:ring-1 focus:ring-tide"
                        >
                          {CATEGORIES.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveItem(item)}
                            className="rounded-md bg-tide px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-tide/90"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingId(null); setSaveError(""); }}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                        {saveError && (
                          <p className="text-[11px] text-red-600 mt-1">{saveError}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-ink">{item.text}</p>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {item.confidence == null ? "N/A" : `${Math.round(item.confidence)}%`}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-tide">{item.category}</p>
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard.writeText(item.text)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function OCRBoxOverlay({
  item,
  imageSize
}: {
  item: OCRItem;
  imageSize: { width: number; height: number };
}) {
  if (
    item.bboxLeft == null ||
    item.bboxTop == null ||
    item.bboxWidth == null ||
    item.bboxHeight == null ||
    imageSize.width === 0 ||
    imageSize.height === 0
  ) {
    return null;
  }

  return (
    <div
      title={item.text}
      className="pointer-events-none absolute rounded border border-emerald-400 bg-emerald-300/10"
      style={{
        left: `${(item.bboxLeft / imageSize.width) * 100}%`,
        top: `${(item.bboxTop / imageSize.height) * 100}%`,
        width: `${(item.bboxWidth / imageSize.width) * 100}%`,
        height: `${(item.bboxHeight / imageSize.height) * 100}%`
      }}
    />
  );
}

function updateScanItem(scan: OCRScan | null, item: OCRItem) {
  if (!scan) return scan;
  if (scan.id !== item.scanId) return scan;

  return {
    ...scan,
    items: scan.items.map((current) => current.id === item.id ? item : current),
    rawText: scan.items.map((current) => current.id === item.id ? item.text : current.text).join("\n")
  };
}
