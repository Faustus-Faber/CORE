import { EvidencePost } from "../services/evidenceService";
import { AuthUser } from "../types";
import { MediaCollage } from "./MediaCollage";

interface EvidencePostCardProps {
  post: EvidencePost;
  user: AuthUser | null;
  onSelect: (post: EvidencePost) => void;
  onLike: (id: string) => void;
  onShare: (post: EvidencePost) => void;
  onDelete: (id: string) => void;
  onEdit: (post: EvidencePost) => void;
  onVerify: (id: string) => void;
  onComment: (id: string, content: string) => void;
  onFlag: (id: string) => void;
}

export function EvidencePostCard({
  post,
  user,
  onSelect,
  onLike,
  onShare,
  onDelete,
  onEdit,
  onVerify,
  onComment,
  onFlag,
}: EvidencePostCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
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
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-slate-900">{post.user.fullName}</p>
              {post.isVerified && (
                <span className="inline-flex items-center rounded-full bg-blue-100 p-0.5 text-blue-600" title="Verified Evidence">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{post.location}</span>
              <span>•</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                {post.user.role}
              </span>
              <span>•</span>
              <time>{new Date(post.createdAt).toLocaleString()}</time>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "ADMIN" && !post.isVerified && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVerify(post.id);
              }}
              className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 transition hover:bg-blue-100"
            >
              Verify
            </button>
          )}
          {user && post.userId !== user.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFlag(post.id);
              }}
              className="text-slate-400 hover:text-orange-600 transition"
              title="Report Post"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
          )}
          {user && post.userId === user.id && (
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(post);
                }}
                className="text-slate-400 hover:text-blue-600 transition"
                title="Edit Post"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(post.id);
                }}
                className="text-slate-400 hover:text-red-600 transition"
                title="Delete Post"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div 
        className="px-4 pb-3 cursor-pointer"
        onClick={() => onSelect(post)}
      >
        <h3 className="text-lg font-bold text-slate-900">{post.title}</h3>
        <p className="mt-1 text-slate-700">{post.description}</p>
      </div>

      <MediaCollage post={post} onClick={() => onSelect(post)} />

      <div className="border-t border-slate-100 p-2">
        <div className="flex items-center justify-around border-b border-slate-100 pb-2 mb-2">
          <button 
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              post.likes.some(l => l.userId === user?.id) 
              ? "text-blue-600 bg-blue-50 font-bold" 
              : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-5 w-5" fill={post.likes.some(l => l.userId === user?.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.708C19.746 10 20.5 10.89 20.5 12c0 .282-.058.55-.164.793l-2.5 5.625A2 2 0 0116.015 20H8V10l4.304-4.842a1 1 0 01.75-.316H13a2 2 0 012 2V10h-1zm-6 0H4a2 2 0 00-2 2v6a2 2 0 002 2h4V10z" />
            </svg>
            {post._count.likes} Like
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition"
            onClick={() => {
              const el = document.getElementById(`comment-input-${post.id}`);
              el?.focus();
            }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post._count.comments} Comment
          </button>
          <button 
            onClick={() => onShare(post)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>

        <form 
          className="flex gap-2 px-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem(`comment-input-${post.id}`) as HTMLInputElement;
            if (input.value.trim()) {
              onComment(post.id, input.value);
              input.value = "";
            }
          }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} className="h-full w-full rounded-full object-cover" />
            ) : (
              user?.fullName.charAt(0) || "?"
            )}
          </div>
          <input
            id={`comment-input-${post.id}`}
            name={`comment-input-${post.id}`}
            type="text"
            placeholder="Write a comment..."
            className="flex-grow rounded-full bg-slate-100 px-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>
      </div>
    </article>
  );
}
