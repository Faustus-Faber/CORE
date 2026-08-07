import { useState, useEffect } from "react";
import { createEvidencePost } from "../services/evidenceService";

interface CreateEvidenceInCrisisProps {
  crisisEventId: string;
  onEvidenceCreated: () => void;
}

const VISIBILITY_OPTIONS = [
  { value: "INCIDENT_TEAM", label: "Incident Team", desc: "Responders & coordinators on this crisis" },
  { value: "ORGANIZATION", label: "Organization", desc: "Anyone in the organization" },
  { value: "REDACTED_PUBLIC", label: "Public (Redacted)", desc: "Public view with sensitive data removed" },
  { value: "PRIVATE", label: "Private", desc: "Only you can see this" },
];

export function CreateEvidenceInCrisis({ crisisEventId, onEvidenceCreated }: CreateEvidenceInCrisisProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [visibility, setVisibility] = useState("INCIDENT_TEAM");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const allFiles = Array.from(e.target.files);
    const validFiles = allFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length < allFiles.length) {
      setError("Some files were too large (max 50MB) and were skipped");
    } else {
      setError("");
    }
    const selected = validFiles.slice(0, 5);
    setFiles(selected);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls(selected.map(f => URL.createObjectURL(f)));
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setMediaType("IMAGE");
    setVisibility("INCIDENT_TEAM");
    setFiles([]);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Please select at least one image or video.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("location", location || "Crisis location");
    formData.append("mediaType", mediaType);
    formData.append("crisisEventId", crisisEventId);
    formData.append("visibility", visibility);
    files.forEach(file => formData.append("media", file));

    try {
      await createEvidencePost(formData);
      resetForm();
      setExpanded(false);
      onEvidenceCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload evidence");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-tide hover:bg-tide/5 hover:text-tide"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Upload Evidence to This Crisis
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink">Upload Crisis Evidence</h4>
        <button
          type="button"
          onClick={() => { resetForm(); setExpanded(false); }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700">Title *</label>
          <input
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-tide focus:ring-1 focus:ring-tide"
            placeholder="E.g., Flood damage on Road 12"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Description *</label>
          <textarea
            required
            maxLength={5000}
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-tide focus:ring-1 focus:ring-tide resize-none"
            placeholder="What does this evidence show?"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Media Type</label>
            <select
              value={mediaType}
              onChange={e => {
                setMediaType(e.target.value as "IMAGE" | "VIDEO");
                setFiles([]);
                previewUrls.forEach(url => URL.revokeObjectURL(url));
                setPreviewUrls([]);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-tide focus:ring-1 focus:ring-tide bg-white"
            >
              <option value="IMAGE">Images</option>
              <option value="VIDEO">Videos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Visibility</label>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-tide focus:ring-1 focus:ring-tide bg-white"
            >
              {VISIBILITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          {VISIBILITY_OPTIONS.find(o => o.value === visibility)?.desc}
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Location (optional)</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-tide focus:ring-1 focus:ring-tide"
            placeholder="E.g., Mirpur-10, Dhaka"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Files (Max 5) *</label>
          <input
            type="file"
            multiple
            accept={mediaType === "IMAGE" ? "image/*" : "video/*"}
            onChange={handleFileChange}
            className="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-tide/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-tide hover:file:bg-tide/20"
          />
        </div>

        {previewUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-1">
            {previewUrls.map((url, i) => (
              <div key={url} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200">
                {mediaType === "IMAGE" ? (
                  <img src={url} alt={`Preview ${i}`} className="h-full w-full object-cover" />
                ) : (
                  <video src={url} className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-tide px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60"
          >
            {isSubmitting ? "Uploading..." : "Upload Evidence"}
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setExpanded(false); }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
