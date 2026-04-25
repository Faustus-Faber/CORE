import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getOCRHistory,
  getOCRScan,
  OCRItem,
  OCRScan,
  updateOCRItem,
  uploadOCRImage
} from "../services/api";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "http://localhost:5000/api").replace("/api", "");
const CATEGORIES = ["License Plate", "Street Address", "Warning Label", "Sign", "General Text"];

export function OCRToolPage() {
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeScan, setActiveScan] = useState<OCRScan | null>(null);
  const [history, setHistory] = useState<OCRScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const refreshHistory = async () => {
    setLoading(true);
    try {
      const data = await getOCRHistory(1, 20);
      setHistory(data.scans);
      setActiveScan((current) => current ?? data.scans[0] ?? null);
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
    const scanId = (location.state as { scanId?: string } | null)?.scanId;
    if (!scanId) return;

    getOCRScan(scanId)
      .then(({ scan }) => setActiveScan(scan))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load OCR scan"));
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
      const { scan } = await uploadOCRImage({ image: selectedFile });
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
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Secure Documentation</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">OCR Scan Tool</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Extract readable field text from disaster images and save it for documentation or NGO report appendices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Select Image
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {selectedFile ? selectedFile.name : "No image selected"}
              </p>
              <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP up to 10MB</p>
            </div>
            <button
              type="button"
              disabled={!selectedFile || scanning}
              onClick={() => void handleScan()}
              className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {scanning ? "Extracting Text..." : "Extract Text"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">OCR History</h2>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading scans...</p>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No OCR scans yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((scan) => (
                  <button
                    key={scan.id}
                    type="button"
                    onClick={() => setActiveScan(scan)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      activeScan?.id === scan.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">{scan.sourceFileName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {scan.items.length} text items · {new Date(scan.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {activeScan ? (
            <OCRScanDetails scan={activeScan} onItemUpdated={handleItemUpdated} />
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500">
              Select or create an OCR scan to view extracted text.
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

  const startEditing = (item: OCRItem) => {
    setEditingId(item.id);
    setDraftText(item.text);
    setDraftCategory(item.category);
  };

  const saveItem = async (item: OCRItem) => {
    const { item: updated } = await updateOCRItem(scan.id, item.id, {
      text: draftText,
      category: draftCategory
    });
    onItemUpdated(updated);
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{scan.sourceFileName}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Provider: {scan.provider} · Created {new Date(scan.createdAt).toLocaleString()}
          </p>
          {scan.folder && <p className="mt-1 text-xs font-medium text-blue-600">Folder: {scan.folder.name}</p>}
        </div>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(scan.rawText)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Copy All Text
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img
            src={`${API_ORIGIN}${scan.sourceImageUrl}`}
            alt={scan.sourceFileName}
            onLoad={(event) => {
              setImageSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight
              });
            }}
            className="max-h-[560px] w-full object-contain"
          />
          {imageSize && scan.items.map((item) => (
            <OCRBoxOverlay key={item.id} item={item} imageSize={imageSize} />
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Extracted Text</h3>
          {scan.items.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No readable text was detected.</p>
          ) : (
            scan.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                      rows={2}
                    />
                    <select
                      value={draftCategory}
                      onChange={(event) => setDraftCategory(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveItem(item)}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.text}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {item.confidence == null ? "N/A" : `${Math.round(item.confidence)}%`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-blue-600">{item.category}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(item.text)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
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
