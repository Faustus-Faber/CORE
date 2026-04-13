import { EvidencePost } from "../services/evidenceService";
import { AuthUser } from "../types";

interface PostModalProps {
  post: EvidencePost;
  onClose: () => void;
  user: AuthUser | null;
  onLike: (id: string) => void;
  onShare: (post: EvidencePost) => void;
  onVerify: (id: string) => void;
  onFlag: (id: string) => void;
}

const apiBaseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace("/api", "") : "http://localhost:4000";

export function PostModal({ post, onClose, user, onLike, onShare, onVerify, onFlag }: PostModalProps) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/20 p-2 text-white transition hover:bg-black/40"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row">
          <div className="bg-black md:w-2/3 flex flex-col items-center justify-center min-h-[400px]">
            {post.mediaUrls.length > 1 && (
              <div className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide bg-slate-900">
                {post.mediaUrls.map((url, idx) => (
                  <div key={idx} className="relative min-w-full h-[500px] flex-shrink-0 snap-center flex items-center justify-center">
                    {post.mediaType === "IMAGE" ? (
                      <img
                        src={`${apiBaseUrl}${url}`}
                        alt={`${post.title} - ${idx + 1}`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <video
                        src={`${apiBaseUrl}${url}`}
                        controls
                        className="h-full w-full object-contain"
                      />
                    )}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                      {idx + 1} / {post.mediaUrls.length}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {post.mediaUrls.length === 1 && (
              <div className="relative w-full h-[500px] flex items-center justify-center">
                {post.mediaType === "IMAGE" ? (
                  <img
                    src={`${apiBaseUrl}${post.mediaUrls[0]}`}
                    alt={post.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <video
                    src={`${apiBaseUrl}${post.mediaUrls[0]}`}
                    controls
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col p-6 md:w-1/3">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                {post.user.avatarUrl ? (
                  <img
                    src={post.user.avatarUrl}
                    alt={post.user.fullName}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  post.user.fullName.charAt(0)
                )}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-900">{post.user.fullName}</p>
                  {post.isVerified && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 p-0.5 text-blue-600" title="Verified Evidence">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{post.location}</span>
                  <span>•</span>
                  <time>{new Date(post.createdAt).toLocaleString()}</time>
                </div>
              </div>
            </div>

            <div className="mt-4 flex-grow overflow-y-auto pr-2">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-900">{post.title}</h2>
                {user?.role === "ADMIN" && !post.isVerified && (
                  <button
                    onClick={() => onVerify(post.id)}
                    className="shrink-0 rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 transition hover:bg-blue-100"
                  >
                    Verify Post
                  </button>
                )}
              </div>
              <p className="mt-2 text-slate-700 whitespace-pre-wrap">{post.description}</p>

              <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-500">Comments ({post.comments.length})</h3>
                <div className="mt-4 space-y-4">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2 text-sm">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {comment.user.fullName.charAt(0)}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <span className="font-semibold text-slate-900">{comment.user.fullName}</span>
                        <p className="text-slate-700">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="flex items-center gap-4 text-sm font-medium">
                <button 
                  onClick={() => onLike(post.id)}
                  className={`flex items-center gap-1 ${
                    post.likes.some(l => l.userId === user?.id) ? "text-blue-600" : "text-slate-600"
                  }`}
                >
                  Like ({post._count.likes})
                </button>
                <button 
                  onClick={() => onShare(post)}
                  className="text-slate-600"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
