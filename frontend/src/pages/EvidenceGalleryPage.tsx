import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  listEvidencePosts, 
  toggleLikePost, 
  addComment, 
  deleteEvidencePost, 
  updateEvidencePost,
  verifyEvidencePost,
  flagEvidencePost,
  type EvidencePost 
} from "../services/evidenceService";
import { CreateEvidencePost } from "../components/CreateEvidencePost";
import { EvidenceFilterBar } from "../components/EvidenceFilterBar";
import { PostModal } from "../components/PostModal";
import { EvidencePostCard } from "../components/EvidencePostCard";

export function EvidenceGalleryPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<EvidencePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPost, setEditingPost] = useState<EvidencePost | null>(null);
  const [selectedPost, setSelectedPost] = useState<EvidencePost | null>(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await listEvidencePosts({ filter, sort });
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPosts();
  }, [filter, sort]);

  const handleLike = async (postId: string) => {
    // Optimistic Update
    const postToLike = posts.find(p => p.id === postId);
    if (!postToLike || !user) return;

    const wasLiked = postToLike.likes.some(l => l.userId === user.id);
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        const newLikes = wasLiked 
          ? post.likes.filter(l => l.userId !== user.id)
          : [...post.likes, { userId: user.id }];
        return {
          ...post,
          likes: newLikes,
          _count: { ...post._count, likes: newLikes.length }
        };
      }
      return post;
    });
    setPosts(updatedPosts);
    if (selectedPost?.id === postId) {
      const updatedPost = updatedPosts.find(p => p.id === postId)!;
      setSelectedPost(updatedPost);
    }

    try {
      const { liked } = await toggleLikePost(postId);
      // Verify with server response if needed, but usually redundant if success
    } catch (err) {
      // Revert on error
      console.error("Failed to like", err);
      setPosts(current => current.map(post => {
        if (post.id === postId) {
          const oldLikes = wasLiked 
            ? [...post.likes, { userId: user.id }]
            : post.likes.filter(l => l.userId !== user.id);
          return {
            ...post,
            likes: oldLikes,
            _count: { ...post._count, likes: oldLikes.length }
          };
        }
        return post;
      }));
    }
  };

  const handleAddComment = async (postId: string, content: string) => {
    // Optimistic update is harder for comments because we need the comment object from server (with ID)
    // but we can add a temporary one
    try {
      const newComment = await addComment(postId, content);
      setPosts(current => current.map(post => {
        if (post.id === postId) {
          const updatedPost = {
            ...post,
            comments: [...post.comments, newComment],
            _count: { ...post._count, comments: post._count.comments + 1 }
          };
          if (selectedPost?.id === postId) {
            setSelectedPost(updatedPost);
          }
          return updatedPost;
        }
        return post;
      }));
    } catch (err) {
      console.error("Failed to comment", err);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteEvidencePost(postId);
      setPosts(current => current.filter(p => p.id !== postId));
    } catch (err) {
      alert("Failed to delete post");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    try {
      const updated = await updateEvidencePost(editingPost.id, {
        title: editingPost.title,
        description: editingPost.description
      });
      setPosts(current => current.map(p => {
        if (p.id === updated.id) {
          const updatedPost = { ...p, ...updated };
          if (selectedPost?.id === updated.id) {
            setSelectedPost(updatedPost);
          }
          return updatedPost;
        }
        return p;
      }));
      setEditingPost(null);
    } catch (err) {
      alert("Failed to update post");
    }
  };

  const handleShare = (post: EvidencePost) => {
    const shareData = {
      title: post.title,
      text: post.description,
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  const handleVerify = async (postId: string) => {
    try {
      await verifyEvidencePost(postId);
      setPosts(current => current.map(p => p.id === postId ? { ...p, isVerified: true } : p));
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, isVerified: true } : null);
      }
    } catch (err) {
      alert("Failed to verify post");
    }
  };

  const handleFlag = async (postId: string) => {
    const reason = window.prompt("Why are you reporting this post? (e.g., Fake evidence, inappropriate content)");
    if (!reason) return;
    try {
      await flagEvidencePost(postId, reason);
      alert("Post has been reported for review.");
    } catch (err) {
      alert("Failed to report post");
    }
  };

  const canPost = user?.role === "ADMIN" || user?.role === "VOLUNTEER";

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
          Visual Evidence Gallery
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Real-time visual updates from crisis zones, shared by verified responders.
        </p>
      </div>

      {canPost && !editingPost && (
        <CreateEvidencePost onPostCreated={fetchPosts} />
      )}

      <EvidenceFilterBar 
        filter={filter} 
        setFilter={setFilter} 
        sort={sort} 
        setSort={setSort} 
      />

      {selectedPost && (
        <PostModal 
          post={selectedPost} 
          onClose={() => setSelectedPost(null)} 
          user={user}
          onLike={handleLike}
          onShare={handleShare}
          onVerify={handleVerify}
          onFlag={handleFlag}
        />
      )}

      {editingPost && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Edit Post</h2>
          <form onSubmit={handleUpdate} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Title</label>
              <input
                type="text"
                required
                value={editingPost.title}
                onChange={e => setEditingPost({ ...editingPost, title: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                required
                value={editingPost.description}
                onChange={e => setEditingPost({ ...editingPost, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-center text-red-700">
            {error}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-500">
            No evidence has been shared yet.
          </div>
        )}

        {posts.map((post) => (
          <EvidencePostCard 
            key={post.id}
            post={post}
            user={user}
            onSelect={setSelectedPost}
            onLike={handleLike}
            onShare={handleShare}
            onDelete={handleDelete}
            onEdit={setEditingPost}
            onVerify={handleVerify}
            onComment={handleAddComment}
            onFlag={handleFlag}
          />
        ))}
      </div>
    </div>
  );
}
