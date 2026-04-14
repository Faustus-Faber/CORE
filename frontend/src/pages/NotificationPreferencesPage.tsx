import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferencesInput
} from "../services/api";
import { INCIDENT_TYPE_OPTIONS, getTypeIconPath } from "../utils/incident";

const RADIUS_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

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
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Notification Preferences</h1>
          <p className="text-sm text-slate-500 mt-1">Choose which crises alert you and how far to monitor</p>
        </div>
        {saved && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Saved
          </span>
        )}
      </div>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Push Notifications</h2>
            <p className="text-xs text-slate-500 mt-1">Enable or disable all crisis alerts</p>
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
      </section>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Crisis Categories</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {INCIDENT_TYPE_OPTIONS.map((type) => {
            const isSelected = selectedTypes.includes(type.value);
            return (
              <button
                key={type.value}
                onClick={() => toggleType(type.value)}
                type="button"
                disabled={!isActive}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } ${!isActive ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                  isSelected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                }`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d={getTypeIconPath(type.value)} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{type.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {isSelected ? "Alerts enabled" : "Not subscribed"}
                  </p>
                </div>
                <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                }`}>
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Notification Radius</h2>
            <p className="text-xs text-slate-500 mt-1">Alert distance from your registered location</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {radiusKm} km
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRadiusKm(r)}
              disabled={!isActive}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                radiusKm === r
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              } ${!isActive ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {r} km
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-panel ring-1 ring-slate-200">
        <button
          onClick={handleSave}
          disabled={isSaving || !isActive || selectedTypes.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? "Preferences Saved" : isSaving ? "Saving..." : "Save Preferences"}
        </button>
      </section>
    </div>
  );
}
