import { clampScore, credibilityStyle } from "../utils/incident";

type CredibilityWheelProps = {
  score: number;
  size?: "sm" | "lg";
  showLabel?: boolean;
};

const DIMENSIONS = {
  sm: { box: 48, radius: 18, stroke: 5, fontClass: "text-xs" },
  lg: { box: 88, radius: 34, stroke: 8, fontClass: "text-base" }
};

export function CredibilityWheel({ score, size = "sm", showLabel = false }: CredibilityWheelProps) {
  const safeScore = clampScore(score);
  const style = credibilityStyle(safeScore);
  const { box, radius, stroke, fontClass } = DIMENSIONS[size];
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeScore / 100) * circumference;
  const center = box / 2;
  const pixelSize = size === "sm" ? "h-10 w-10" : "h-20 w-20";

  return (
    <div className={showLabel ? "flex min-w-[112px] flex-col items-center justify-center rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200" : `relative ${pixelSize} flex-shrink-0`}>
      <div className={`relative ${pixelSize}`}>
        <svg viewBox={`0 0 ${box} ${box}`} className={pixelSize}>
          <circle cx={center} cy={center} r={radius} strokeWidth={stroke} className={`fill-none ${style.track}`} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            className={`fill-none ${style.stroke}`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${fontClass} font-bold ${style.text}`}>{safeScore}</span>
        </div>
      </div>
      {showLabel && (
        <>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Credibility</p>
          <p className={`text-[11px] font-semibold ${style.text}`}>{style.label}</p>
        </>
      )}
    </div>
  );
}
