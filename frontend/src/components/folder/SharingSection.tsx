import React from 'react';

interface SharingSectionProps {
    expiration: string;
    setExpiration: (hours: string) => void;
    shareUrl: string | null;
    handleShare: () => void;
    handleRevoke: () => void;
}

export const SharingSection: React.FC<SharingSectionProps> = ({
    expiration,
    setExpiration,
    shareUrl,
    handleShare,
    handleRevoke
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 mb-1">Privacy Status</h3>
                        <p className="text-sm text-slate-500 mb-4">Control who can access this folder</p>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <h4 className="font-medium text-slate-900 flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Private
                            </h4>
                            <p className="text-sm text-slate-600">Only you can view this folder. Generate a link to share read-only access.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="bg-blue-50 p-2.5 rounded-lg text-blue-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">Shareable Read-Only Link</h3>
                        <p className="text-sm text-slate-500 mb-5">Anyone with the link can view (but not edit) this folder</p>

                        <label className="block text-sm font-medium text-slate-700 mb-3">Link Expiration</label>
                        <div className="flex flex-wrap gap-3 mb-6">
                            {['1', '24', '168', '0'].map((hours) => {
                                const label = hours === '1' ? '1 hour' : hours === '24' ? '24 hours' : hours === '168' ? '7 days' : 'No expiry';
                                const isActive = expiration === hours;
                                return (
                                    <button
                                        key={hours}
                                        onClick={() => setExpiration(hours)}
                                        className={`px-4 py-2 text-sm rounded-full border transition-all ${isActive ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {shareUrl && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <label className="block text-xs font-bold text-green-700 uppercase mb-2">Active Share Link</label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        readOnly
                                        value={shareUrl}
                                        className="min-w-0 flex-1 rounded border border-green-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-700"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(shareUrl || '');
                                            alert("Copied to clipboard!");
                                        }}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-green-600 italic">Anyone with this link can view this folder as a read-only guest.</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button onClick={handleShare} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
                                {shareUrl ? 'Regenerate Link' : 'Generate Shareable Link'}
                            </button>
                            {shareUrl && (
                                <button onClick={handleRevoke} className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50">
                                    Revoke Link
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
