import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferencesInput
} from "../services/api";
import { INCIDENT_TYPE_OPTIONS } from "../utils/incident";

export function NotificationPreferencesPage() {
  const { user } = useAuth();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getNotificationPreferences().then((data) => {
      setSelectedTypes(data.incidentTypes);
      setRadiusKm(data.radiusKm);
      setIsActive(data.isActive);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateNotificationPreferences({
        incidentTypes: selectedTypes,
        radiusKm,
        isActive
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Notification Preferences</h1>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Push Notifications</h2>
            <p className="text-xs text-slate-500">Enable or disable all alerts</p>
          </div>
          <button
            onClick={() => setIsActive(!isActive)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isActive ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isActive ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Crisis Categories</h2>
          <div className="grid grid-cols-2 gap-2">
            {INCIDENT_TYPE_OPTIONS.map((type) => (
              <label
                key={type.value}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedTypes.includes(type.value)
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type.value)}
                  onChange={() => toggleType(type.value)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700">Notification Radius</h2>
            <span className="text-sm font-medium text-slate-600">{radiusKm} km</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            value={radiusKm}
            onChange={(e) => setRadiusKm(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>5 km</span>
            <span>50 km</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !isActive || selectedTypes.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saved ? "Saved!" : isSaving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
