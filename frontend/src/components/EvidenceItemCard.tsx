import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { uploadOCRImage, type OCRScan } from "../services/api";
import { verifyEvidencePost } from "../services/evidenceService";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "/api").replace("/api", "") || "";

/** Split the combined AI summary + raw OCR text into separate parts */
function parseCombinedText(rawText: string) {
  if (rawText.includes("--- AI SCENARIO SUMMARY ---")) {
    const parts = rawText.split("--- RAW EXTRACTED TEXT ---");
    const aiPart = parts[0].replace("--- AI SCENARIO SUMMARY ---", "").trim();
    const rawPart = parts[1] ? parts[1].trim() : "";
    return { aiSummary: aiPart, rawExtracted: rawPart };
  }
  return { aiSummary: null, rawExtracted: rawText };
}

interface EvidenceItemCardProps {
  evidence: {
    id: string;
    title: string;
    description: string;
    mediaUrls: string[];
    mediaType: string;
    isVerified: boolean;
    visibility: string;
    uploaderName: string;
    uploaderAvatar?: string | null;
    createdAt: string;
  };
  crisisEventId: string;
  isAdmin: boolean;
}

const VISIBILITY_LABELS: Record<string, { label: string; class: string }> = {
  PRIVATE: { label: "Private", class: "bg-slate-100 text-slate-600" },
  INCIDENT_TEAM: { label: "Incident Team", class: "bg-blue-50 text-blue-700" },
  ORGANIZATION: { label: "Organization", class: "bg-purple-50 text-purple-700" },
  REDACTED_PUBLIC: { label: "Public (Redacted)", class: "bg-emerald-50 text-emerald-700" },
  SHARE_PACKAGE: { label: "Shared", class: "bg-amber-50 text-amber-700" },
};

export function EvidenceItemCard({ evidence, crisisEventId, isAdmin }: EvidenceItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRScan | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrConsent, setOcrConsent] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [isVerified, setIsVerified] = useState(evidence.isVerified);
  const [verifying, setVerifying] = useState(false);

  const visInfo = VISIBILITY_LABELS[evidence.visibility] ?? VISIBILITY_LABELS.REDACTED_PUBLIC;
  const firstMedia = evidence.mediaUrls?.[0];

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await verifyEvidencePost(evidence.id);
      setIsVerified(true);
    } catch (err) {
      console.error("Failed to verify evidence:", err);
      alert(err instanceof Error ? err.message : "Failed to verify evidence");
    } finally {
      setVerifying(false);
    }
  };

  const handleRunOcr = async () => {
    if (!ocrFile || !ocrConsent) return;
    setOcrLoading(true);
    setOcrError("");
    try {
      const result = await uploadOCRImage({
        image: ocrFile,
        crisisEventId,
        aiConsent: true,
      });
      setOcrResult(result.scan);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR failed");
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-bold text-ink">{evidence.title}</h4>
              {isVerified && (
                <span className="flex-shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              by {evidence.uploaderName} · {new Date(evidence.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${visInfo.class}`}>
            {visInfo.label}
          </span>
        </div>

        {/* Thumbnail */}
        {firstMedia && (
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
            {evidence.mediaType === "IMAGE" ? (
              <img
                src={`${API_ORIGIN}${firstMedia}`}
                alt={evidence.title}
                className="h-32 w-full object-cover"
                loading="lazy"
              />
            ) : (
              <video
                src={`${API_ORIGIN}${firstMedia}`}
                className="h-32 w-full object-cover"
                controls
              />
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {expanded ? "Hide details" : "Details"}
          </button>
          {evidence.mediaType === "IMAGE" && (
            <button
              type="button"
              onClick={() => setShowOcrModal(true)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Run OCR
            </button>
          )}
          {isAdmin && !isVerified && (
            <button
              type="button"
              disabled={verifying}
              onClick={() => void handleVerify()}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify Evidence"}
            </button>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-700">{evidence.description}</p>
            {evidence.mediaUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto py-1">
                {evidence.mediaUrls.map((url, i) => (
                  <div key={i} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200">
                    {evidence.mediaType === "IMAGE" ? (
                      <img src={`${API_ORIGIN}${url}`} alt={`Media ${i}`} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <video src={`${API_ORIGIN}${url}`} className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-400">
              {evidence.mediaUrls.length} file{evidence.mediaUrls.length !== 1 ? "s" : ""} · {evidence.mediaType}
            </div>
          </div>
        )}
      </div>

      {/* OCR Modal */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowOcrModal(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Run OCR on Evidence</h3>
              <button type="button" onClick={() => setShowOcrModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!ocrResult && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  <p className="font-semibold">Evidence: {evidence.title}</p>
                  <p className="mt-1">Upload an image file to extract text using AI-powered OCR. The result will be linked to this crisis.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700">Select image to scan</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setOcrFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-tide/10 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-tide hover:file:bg-tide/20"
                  />
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={ocrConsent}
                    onChange={e => setOcrConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-tide focus:ring-tide"
                  />
                  <span className="text-xs text-slate-700">
                    I consent to sending this image to a third-party AI provider (Google Gemini) for text extraction.
                    This is required for OCR processing per FR-10.
                  </span>
                </label>

                {ocrError && (
                  <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{ocrError}</div>
                )}

                <button
                  type="button"
                  disabled={!ocrFile || !ocrConsent || ocrLoading}
                  onClick={handleRunOcr}
                  className="w-full rounded-lg bg-tide px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  {ocrLoading ? "Processing..." : "Extract Text"}
                </button>
              </div>
            )}

            {ocrResult && (() => {
              const { aiSummary, rawExtracted } = parseCombinedText(ocrResult.rawText);
              return (
                <div className="space-y-4">
                  <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                    OCR completed successfully. Extracted text is linked to this crisis.
                  </div>

                  {aiSummary && (
                    <div>
                      <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        <svg className="h-4 w-4 text-tide" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        AI Scenario Summary
                      </h4>
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800 prose prose-xs max-w-none prose-headings:text-ink prose-strong:text-ink prose-p:my-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {aiSummary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-ink">Extracted Text</h4>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
                      {rawExtracted || "(no text extracted)"}
                    </div>
                  </div>

                  {ocrResult.items && ocrResult.items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-ink">Structured Items ({ocrResult.items.length})</h4>
                      <div className="mt-2 space-y-1">
                        {ocrResult.items.map((item, i) => (
                          <div key={item.id} className="rounded border border-slate-100 bg-white p-2 text-xs">
                            <span className="font-mono text-[10px] text-slate-400">{item.category}</span>
                            <p className="mt-0.5 text-slate-700">{item.text}</p>
                            {item.confidence != null && (
                              <span className="text-[10px] text-slate-400">Confidence: {(item.confidence * 100).toFixed(0)}%</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => { setOcrResult(null); setOcrFile(null); setOcrConsent(false); setShowOcrModal(false); }}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
