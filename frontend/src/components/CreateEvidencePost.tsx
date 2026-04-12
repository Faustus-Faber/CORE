import { useState } from "react";
import { createEvidencePost } from "../services/evidenceService";
import LocationPicker from "./LocationPicker";

interface CreateEvidencePostProps {
  onPostCreated: () => void;
}

export function CreateEvidencePost({ onPostCreated }: CreateEvidencePostProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).slice(0, 5);
      setFiles(selectedFiles);

      // Clean up old previews
      previewUrls.forEach(url => URL.revokeObjectURL(url));

      // Generate new previews
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(newPreviews);
    }
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
    formData.append("location", location);
    if (coords) {
      formData.append("latitude", coords.lat.toString());
      formData.append("longitude", coords.lng.toString());
    }
    formData.append("mediaType", mediaType);
    files.forEach((file) => {
      formData.append("media", file);
    });

    try {
      await createEvidencePost(formData);
      setTitle("");
      setDescription("");
      setLocation("");
      setCoords(null);
      setFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      onPostCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Share Evidence</h2>
      <p className="mt-1 text-sm text-slate-500">
        Post images or videos of natural crises to inform the community.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g., Flood in Downtown Area"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
            placeholder="What's happening? Be as specific as possible."
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {showMap ? "Hide Map" : "Select on Map"}
            </button>
          </div>
          {showMap ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <LocationPicker 
                onLocationSelect={(lat, lng, address) => {
                  setCoords({ lat, lng });
                  if (address) setLocation(address);
                }} 
              />
            </div>
          ) : (
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g., North Street, Block B"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Media Type</label>
            <select
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value as "IMAGE" | "VIDEO");
                setFiles([]);
                previewUrls.forEach(url => URL.revokeObjectURL(url));
                setPreviewUrls([]);
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="IMAGE">Images</option>
              <option value="VIDEO">Videos</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Files (Max 5)</label>
            <input
              type="file"
              multiple
              accept={mediaType === "IMAGE" ? "image/*" : "video/*"}
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>

        {previewUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-2">
            {previewUrls.map((url, i) => (
              <div key={url} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200">
                {mediaType === "IMAGE" ? (
                  <img src={url} alt={`Preview ${i}`} className="h-full w-full object-cover" />
                ) : (
                  <video src={url} className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isSubmitting ? "Posting..." : "Post Evidence"}
        </button>
      </form>
    </div>
  );
}
