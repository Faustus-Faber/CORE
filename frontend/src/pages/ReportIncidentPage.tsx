import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import LocationPicker from "../components/LocationPicker";
import { createEmergencyReport } from "../services/api";
import type { IncidentType } from "../types";

const incidentTypeOptions: Array<{ value: IncidentType; label: string }> = [
  { value: "FLOOD", label: "Flood" },
  { value: "FIRE", label: "Fire" },
  { value: "EARTHQUAKE", label: "Earthquake" },
  { value: "BUILDING_COLLAPSE", label: "Building Collapse" },
  { value: "ROAD_ACCIDENT", label: "Road Accident" },
  { value: "VIOLENCE", label: "Violence" },
  { value: "MEDICAL_EMERGENCY", label: "Medical Emergency" },
  { value: "OTHER", label: "Other" }
];

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
        <p className="mt-2 text-slate-700">
          Submit structured text and optional voice/media evidence for crisis
          response teams.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-white p-6 shadow-panel ring-1 ring-slate-200"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Incident Title
            <input
              required
              value={incidentTitle}
              onChange={(event) => setIncidentTitle(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Incident Type
            <select
              value={incidentType}
              onChange={(event) =>
                setIncidentType(event.target.value as IncidentType)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {incidentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">
            Description (optional if voice note is attached)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="space-y-1 md:col-span-2">
            <p className="text-sm font-medium text-ink">
              Location
            </p>
            <p className="text-xs text-slate-500">
              Pin the incident on the map or search for an address. GPS auto-detect available.
            </p>
            <LocationPicker
              onLocationSelect={(lat, lng, address) => {
                setLatitude(lat);
                setLongitude(lng);
                setLocationText(address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              }}
            />
            {latitude != null && longitude != null && (
              <p className="text-xs text-slate-500">
                📍 {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </p>
            )}
          </div>
          <label className="space-y-1 text-sm font-medium md:col-span-2">
            Photos / Videos (max 5)
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(event) =>
                setMediaFiles(Array.from(event.target.files ?? []))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-6 rounded-lg bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">
            Voice Note (Record or Upload)
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={isRecording}
              className="rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Start Recording
            </button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={!isRecording}
              className="rounded-md bg-ember px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Stop Recording
            </button>
            <span className="text-sm text-slate-600">
              {isRecording ? `Recording ${formatTimer(recordingSeconds)}` : "Idle"}
            </span>
          </div>

          {recordedAudioBlob && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-slate-700">
                Recorded clip ready: {recordedAudioFilename || "voice.webm"}
              </p>
              {recordedAudioUrl && <audio controls src={recordedAudioUrl} />}
              <div>
                <button
                  type="button"
                  onClick={clearRecordedAudio}
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium"
                >
                  Clear Recording
                </button>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="space-y-1 text-sm font-medium">
              Upload Audio File (.mp3, .wav, .webm)
              <input
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
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            {uploadedAudioFile && (
              <p className="mt-2 text-sm text-slate-700">
                Selected audio: {uploadedAudioFile.name}
              </p>
            )}
          </div>
        </div>

        {mediaFiles.length > 0 && (
          <p className="mt-3 text-sm text-slate-700">
            {mediaFiles.length} media file(s) selected.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 w-full rounded-md bg-tide px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Analyzing and submitting..." : "Submit Incident Report"}
        </button>
      </form>
    </div>
  );
}
