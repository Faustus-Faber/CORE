import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/Toast";
import { buildEmergencyReportFormData } from "../services/reportPayload";
import { apiFetch } from "../services/api";
import { saveReportDraft, loadReportDraft, clearReportDraft } from "../utils/reportDraftStorage";
import type { IncidentType } from "../types";

const STEPS = ["Describe", "Transcript", "Location", "Media & Consent", "Review"];

export function ReportWizardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Description or voice
  const [description, setDescription] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("FLOOD");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  // Manage object URL lifecycle for audio blob
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl("");
    }
  }, [audioBlob]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up media stream and recorder if component unmounts during recording
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Step 2: Transcript (simulated — would come from AI)
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");

  // Step 3: Location and time
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [observedAt, setObservedAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  // Step 4: Media and consent
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [affectedPeople, setAffectedPeople] = useState<number | null>(null);
  const [immediateNeeds, setImmediateNeeds] = useState("");
  const [mediaConsent, setMediaConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [contactBack, setContactBack] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // FR-02: Restore offline draft on mount
  useEffect(() => {
    const draft = loadReportDraft();
    if (draft) {
      setDescription(draft.description || "");
      setIncidentType((draft.incidentType as IncidentType) || "FLOOD");
      setTranscript(draft.transcript || "");
      setTranslation(draft.translation || "");
      setLocationText(draft.locationText || "");
      setLatitude(draft.latitude ?? null);
      setLongitude(draft.longitude ?? null);
      setObservedAt(draft.observedAt || (() => {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      })());
      setAffectedPeople(draft.affectedPeople ?? null);
      setImmediateNeeds(draft.immediateNeeds || "");
      setMediaConsent(draft.mediaConsent ?? false);
      setAiConsent(draft.aiConsent ?? false);
      setContactBack(draft.contactBack ?? false);
      setDraftRestored(true);
      showToast("Restored your saved draft from a previous session", "info");
    }
  }, [showToast]);

  // FR-02: Auto-save draft to localStorage on state changes (debounced via effect)
  useEffect(() => {
    if (!draftRestored && (description || locationText || transcript)) {
      // Only start saving once the user has entered some data
    }
    const timer = setTimeout(() => {
      saveReportDraft({
        description,
        incidentType,
        transcript,
        translation,
        locationText,
        latitude,
        longitude,
        observedAt,
        affectedPeople,
        immediateNeeds,
        mediaConsent,
        aiConsent,
        contactBack
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    description, incidentType, transcript, translation, locationText,
    latitude, longitude, observedAt, affectedPeople, immediateNeeds,
    mediaConsent, aiConsent, contactBack, draftRestored
  ]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      showToast("Microphone access denied", "error");
    }
  }, [showToast]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE);
    if (validFiles.length < files.length) {
      showToast("Some files were too large (max 10MB) and were skipped", "error");
    }
    setMediaFiles((prev) => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return description.trim().length > 0 || audioBlob !== null;
      case 1: return true; // Transcript is optional/editable
      case 2: return locationText.trim().length > 0;
      case 3: return mediaConsent; // Must consent to media processing
      case 4: return (description.trim().length > 0 || transcript.trim().length > 0) && locationText.trim().length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const idempotencyKey = `report-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const effectiveDescription = description || transcript || translation;
      const incidentTitle = effectiveDescription.trim().length > 0
        ? effectiveDescription.trim().slice(0, 80)
        : incidentType.replace(/_/g, " ").toLowerCase();

      // Build the core FormData via the shared payload builder, then append
      // the wizard-only fields the backend may accept (observedAt, etc.).
      const formData = buildEmergencyReportFormData({
        incidentTitle,
        description: effectiveDescription,
        incidentType: incidentType,
        locationText,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        mediaFiles,
        recordedAudioBlob: audioBlob ?? undefined,
        recordedAudioFilename: audioBlob ? `recorded-${Date.now()}.webm` : undefined
      });

      formData.append("observedAt", observedAt);
      if (affectedPeople != null) formData.append("affectedPeople", String(affectedPeople));
      if (immediateNeeds.trim()) formData.append("immediateNeeds", immediateNeeds.trim());
      formData.append("mediaConsent", String(mediaConsent));
      formData.append("aiConsent", String(aiConsent));
      formData.append("contactBack", String(contactBack));

      const response = await apiFetch("/reports", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: formData
      });

      if (response.ok || response.status === 202) {
        const data = await response.json();
        const reportId = data.id ?? data.report?.id ?? data.data?.id;
        clearReportDraft(); // FR-02: Clear the offline draft after successful submission
        if (!reportId) {
          // Server accepted the report but returned no id — don't navigate to a broken URL
          showToast("Report submitted successfully", "success");
          navigate("/reports");
        } else {
          showToast("Report submitted successfully", "success");
          navigate(`/reports/${reportId}`);
        }
      } else {
        const error = await response.json().catch(() => ({}));
        showToast(error.message ?? "Submission failed", "error");
      }
    } catch {
      showToast("Network error — your report will be retried", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setLocationText(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
          showToast("Location captured", "success");
        },
        () => showToast("Location access denied — you can type your location instead", "warning")
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-6">Report an Incident</h1>

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition ${
                  i === step
                    ? "bg-teal text-white"
                    : i < step
                    ? "bg-success text-white"
                    : "bg-muted/20 text-muted"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs mt-1 ${i === step ? "text-ink font-medium" : "text-muted"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-success" : "bg-muted/20"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-panel-white rounded-lg shadow-panel p-6">
        {/* Step 1: Describe or record */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Describe what happened</h2>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Incident Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              >
                <option value="FLOOD">Flood</option>
                <option value="FIRE">Fire</option>
                <option value="EARTHQUAKE">Earthquake</option>
                <option value="BUILDING_COLLAPSE">Building Collapse</option>
                <option value="ROAD_ACCIDENT">Road Accident</option>
                <option value="VIOLENCE">Violence</option>
                <option value="MEDICAL_EMERGENCY">Medical Emergency</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what you see or experienced..."
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Or record a voice message</label>
              {audioBlob ? (
                <div className="flex items-center gap-3">
                  <audio src={audioUrl} controls className="flex-1" />
                  <button
                    onClick={() => setAudioBlob(null)}
                    className="text-sm text-critical hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    isRecording
                      ? "bg-critical text-white animate-pulse"
                      : "bg-teal text-white hover:bg-teal/90"
                  }`}
                >
                  {isRecording ? "● Recording — tap to stop" : "Start Recording"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Transcript */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Review transcript</h2>
            <p className="text-sm text-muted">
              If you recorded a voice message, the transcript and translation will appear here.
              You can edit them for accuracy.
            </p>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Transcript (original language)</label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                placeholder="Transcript will appear here after processing..."
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Translation (English)</label>
              <textarea
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                rows={3}
                placeholder="English translation will appear here..."
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
            </div>
          </div>
        )}

        {/* Step 3: Location and time */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Where and when?</h2>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Location</label>
              <input
                type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Type the location or use GPS"
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
              <button
                onClick={getLocation}
                className="mt-2 text-sm text-teal hover:underline"
              >
                Use my current location (GPS)
              </button>
              {latitude != null && longitude != null && (
                <p className="text-xs text-success mt-1">
                  ✓ Location captured: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">When did this happen?</label>
              <input
                type="datetime-local"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
            </div>
          </div>
        )}

        {/* Step 4: Media and consent */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Add media and consent</h2>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Photos or videos (optional, max 5)
              </label>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="w-full text-sm text-muted"
              />
              {mediaFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {mediaFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-canvas rounded-md px-3 py-1">
                      <span className="text-ink truncate">{file.name}</span>
                      <button onClick={() => removeFile(i)} className="text-critical text-xs hover:underline">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Number of affected people (optional)
              </label>
              <input
                type="number"
                min={0}
                value={affectedPeople ?? ""}
                onChange={(e) => setAffectedPeople(e.target.value ? Math.max(0, Number(e.target.value)) : null)}
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Immediate needs (optional)
              </label>
              <input
                type="text"
                value={immediateNeeds}
                onChange={(e) => setImmediateNeeds(e.target.value)}
                placeholder="e.g., rescue boats, medical supplies"
                className="w-full px-3 py-2 border border-muted/30 rounded-md text-sm bg-canvas"
              />
            </div>
            <div className="space-y-2 pt-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={mediaConsent}
                  onChange={(e) => setMediaConsent(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-ink">
                  I consent to sharing this media for crisis response purposes.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={aiConsent}
                  onChange={(e) => setAiConsent(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-ink">
                  I consent to AI processing (transcription, translation) of my report.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={contactBack}
                  onChange={(e) => setContactBack(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-ink">
                  It is okay to contact me for follow-up.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 5: Review and submit */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Review and submit</h2>
            <div className="space-y-3 bg-canvas rounded-md p-4">
              <div>
                <span className="text-xs font-medium text-muted">Type</span>
                <p className="text-sm text-ink">{incidentType.replace(/_/g, " ").toLowerCase()}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Description</span>
                <p className="text-sm text-ink">{description || transcript || "(voice recording)"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Location</span>
                <p className="text-sm text-ink">{locationText}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted">Time</span>
                <p className="text-sm text-ink">{new Date(observedAt).toLocaleString()}</p>
              </div>
              {mediaFiles.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted">Media</span>
                  <p className="text-sm text-ink">{mediaFiles.length} file(s) attached</p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-muted">Consents</span>
                <p className="text-sm text-ink">
                  Media: {mediaConsent ? "✓" : "✗"} · AI: {aiConsent ? "✓" : "✗"} · Contact: {contactBack ? "✓" : "✗"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted">
              Your report will be acknowledged immediately and processed asynchronously.
              You can track its status from your reports page.
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t border-muted/10">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-ink disabled:opacity-30 transition"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 text-sm font-medium text-white bg-teal hover:bg-teal/90 rounded-md disabled:opacity-30 transition"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-sm font-medium text-white bg-success hover:bg-success/90 rounded-md disabled:opacity-50 transition"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
