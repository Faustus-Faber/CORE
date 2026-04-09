import type { EmergencyReportSubmissionInput } from "../types";

export function buildEmergencyReportFormData(
  payload: EmergencyReportSubmissionInput
) {
  const formData = new FormData();

  formData.append("incidentTitle", payload.incidentTitle.trim());
  formData.append("description", payload.description.trim());
  formData.append("incidentType", payload.incidentType);
  formData.append("locationText", payload.locationText.trim());

  if (payload.latitude != null) {
    formData.append("latitude", String(payload.latitude));
  }
  if (payload.longitude != null) {
    formData.append("longitude", String(payload.longitude));
  }

  for (const file of payload.mediaFiles) {
    formData.append("media", file);
  }

  if (payload.uploadedAudioFile) {
    formData.append("voiceNote", payload.uploadedAudioFile);
  } else if (payload.recordedAudioBlob) {
    formData.append(
      "voiceNote",
      payload.recordedAudioBlob,
      payload.recordedAudioFilename ?? `recorded-${Date.now()}.webm`
    );
  }

  return formData;
}
