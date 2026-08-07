import { EvidencePost } from "../services/evidenceService";

interface MediaCollageProps {
  post: EvidencePost;
  onClick: () => void;
}

const apiBaseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/api", "") : "http://localhost:4000";

export function MediaCollage({ post, onClick }: MediaCollageProps) {
  const urls = post.mediaUrls;
  const count = urls.length;
  const isVideo = post.mediaType === 'VIDEO';

  const renderMedia = (url: string, index: number, className = "h-full w-full object-cover") => (
    <div key={index} className="relative h-full w-full overflow-hidden">
      {isVideo ? (
        <video
          src={`${apiBaseUrl}${url}`}
          className={className}
          muted
          loop
          onMouseOver={(e) => e.currentTarget.play()}
          onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
        />
      ) : (
        <img
          src={`${apiBaseUrl}${url}`}
          alt={`${post.title} - ${index + 1}`}
          className={className}
          loading="lazy"
          decoding="async"
        />
      )}
      {count > 5 && index === 4 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">
          +{count - 5}
        </div>
      )}
    </div>
  );

  if (count === 1) {
    return (
      <button
        type="button"
        className="block w-full cursor-pointer overflow-hidden rounded-lg border-0 bg-slate-100 p-0"
        onClick={onClick}
        aria-label={`View ${count} media item from ${post.title}`}
      >
        {renderMedia(urls[0], 0, "max-h-[500px] w-full object-contain")}
      </button>
    );
  }

  if (count === 2) {
    return (
      <button
        type="button"
        className="grid h-56 w-full cursor-pointer grid-cols-2 gap-1 overflow-hidden rounded-lg border-0 bg-slate-100 p-0 sm:h-[300px]"
        onClick={onClick}
        aria-label={`View ${count} media items from ${post.title}`}
      >
        {urls.map((url, i) => renderMedia(url, i))}
      </button>
    );
  }

  if (count === 3) {
    return (
      <button
        type="button"
        className="grid h-64 w-full cursor-pointer grid-cols-2 gap-1 overflow-hidden rounded-lg border-0 bg-slate-100 p-0 sm:h-[400px]"
        onClick={onClick}
        aria-label={`View ${count} media items from ${post.title}`}
      >
        <div className="h-full w-full">
          {renderMedia(urls[0], 0)}
        </div>
        <div className="grid h-full grid-rows-2 gap-1">
          {urls.slice(1, 3).map((url, i) => renderMedia(url, i + 1))}
        </div>
      </button>
    );
  }

  if (count === 4) {
    return (
      <button
        type="button"
        className="grid h-64 w-full cursor-pointer grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg border-0 bg-slate-100 p-0 sm:h-[400px]"
        onClick={onClick}
        aria-label={`View ${count} media items from ${post.title}`}
      >
        {urls.slice(0, 4).map((url, i) => renderMedia(url, i))}
      </button>
    );
  }

  // 5 or more
  return (
    <button
      type="button"
      className="grid h-64 w-full cursor-pointer grid-cols-6 grid-rows-2 gap-1 overflow-hidden rounded-lg border-0 bg-slate-100 p-0 sm:h-[400px]"
      onClick={onClick}
      aria-label={`View ${count} media items from ${post.title}`}
    >
      <div className="col-span-3 row-span-2">
        {renderMedia(urls[0], 0)}
      </div>
      <div className="col-span-3 row-span-1 grid grid-cols-2 gap-1">
        {renderMedia(urls[1], 1)}
        {renderMedia(urls[2], 2)}
      </div>
      <div className="col-span-3 row-span-1 grid grid-cols-2 gap-1">
        {renderMedia(urls[3], 3)}
        {renderMedia(urls[4], 4)}
      </div>
    </button>
  );
}
