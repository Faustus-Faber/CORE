import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import LocationPicker from "../components/LocationPicker";
import { createEmergencyReport } from "../services/api";
import { INCIDENT_TYPE_OPTIONS } from "../utils/incident";
import type { IncidentType } from "../types";

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function ReportIncidentPage() {
  const navigate = useNavigate();
  const [incidentTitle, setIncidentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("FLOOD");
  const [locationText, setLocationText] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recordedAudioFilename, setRecordedAudioFilename] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const hasVoiceInput = useMemo(
    () => Boolean(uploadedAudioFile || recordedAudioBlob),
    [recordedAudioBlob, uploadedAudioFile]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }

    if (!recordedAudioBlob) {
      setRecordedAudioUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(recordedAudioBlob);
    setRecordedAudioUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [recordedAudioBlob]);

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
  };

  const startRecording = async () => {
    setError("");

    if (isRecording) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordedAudioBlob(blob);
        setRecordedAudioFilename(`recorded-${Date.now()}.webm`);
        setUploadedAudioFile(null);
        setRecordingSeconds(0);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecordedAudioBlob(null);
      setRecordedAudioFilename("");
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (recordingError) {
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "Unable to access microphone"
      );
    }
  };

  const clearRecordedAudio = () => {
    setRecordedAudioBlob(null);
    setRecordedAudioFilename("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!description.trim() && !hasVoiceInput) {
      setError("Provide a description or attach a voice note.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createEmergencyReport({
        incidentTitle,
        description,
        incidentType,
        locationText,
        latitude,
        longitude,
        mediaFiles,
        uploadedAudioFile,
        recordedAudioBlob,
        recordedAudioFilename
      });

      navigate("/reports/explore?view=mine", {
        state: {
          justSubmitted: true,
          message: response.message,
          report: response.report
        }
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to submit report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
        <h1 className="text-3xl font-bold text-ink">Report Incident</h1>
        <p className="mt-2 text-sm text-slate-600">
          Submit structured text and optional voice/media evidence for crisis
          response teams.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Incident Details
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="incident-title" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Incident Title
              </label>
              <input
                id="incident-title"
                required
                value={incidentTitle}
                onChange={(event) => setIncidentTitle(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label htmlFor="incident-type" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Incident Type
              </label>
              <select
                id="incident-type"
                value={incidentType}
                onChange={(event) =>
                  setIncidentType(event.target.value as IncidentType)
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
              >
                {INCIDENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Description (optional if voice note is attached)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Location
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="location-text" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Location Name
              </label>
              <input
                id="location-text"
                required
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                placeholder="e.g. Mirpur-10, Dhaka"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pin on Map
              </p>
              <p className="mb-2 text-xs text-slate-500">
                Pin the incident on the map or search for an address. GPS auto-detect available.
              </p>
              <LocationPicker
                onLocationSelect={(lat, lng, address) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  if (address && !locationText.trim()) {
                    setLocationText(address);
                  }
                }}
              />
              {latitude != null && longitude != null && (
                <p className="mt-2 text-xs text-slate-500">
                  Pinned: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Evidence
          </h2>

          <div className="mt-4">
            <label htmlFor="media-files" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Photos / Videos (max 5)
            </label>
            <input
              id="media-files"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(event) =>
                setMediaFiles(Array.from(event.target.files ?? []))
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
            />
            {mediaFiles.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {mediaFiles.length} file(s) selected
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Voice Note
          </h2>
          <p className="mt-1 text-xs text-slate-500">Record live or upload an audio file.</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={isRecording}
              className="rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              Start Recording
            </button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={!isRecording}
              className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              Stop Recording
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isRecording ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
              {isRecording ? `Recording ${formatTimer(recordingSeconds)}` : "Idle"}
            </span>
          </div>

          {recordedAudioBlob && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">
                Recorded clip: {recordedAudioFilename || "voice.webm"}
              </p>
              {recordedAudioUrl && <audio controls src={recordedAudioUrl} className="mt-2" />}
              <button
                type="button"
                onClick={clearRecordedAudio}
                className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-tide hover:text-tide"
              >
                Clear Recording
              </button>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="audio-upload" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Upload Audio File (.mp3, .wav, .webm)
            </label>
            <input
              id="audio-upload"
              type="file"
              accept=".mp3,.wav,.webm,audio/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setUploadedAudioFile(file);
                if (file) {
                  setRecordedAudioBlob(null);
                  setRecordedAudioFilename("");
                }
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink"
            />
            {uploadedAudioFile && (
              <p className="mt-2 text-xs text-slate-500">
                Selected: {uploadedAudioFile.name}
              </p>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-tide px-4 py-3 text-sm font-semibold text-white shadow-panel transition hover:bg-tide/90 disabled:opacity-60"
        >
          {isSubmitting ? "Analyzing and submitting..." : "Submit Incident Report"}
        </button>
      </form>
    </div>
  );
}
