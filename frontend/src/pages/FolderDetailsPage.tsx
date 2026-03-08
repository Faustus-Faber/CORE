import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { docService } from '../services/docService';
import { getCurrentPosition } from '../utils/geo';
import { SecureFolder } from '../types';
import { useAuth } from '../context/AuthContext';

type Tab = 'files' | 'notes' | 'metadata' | 'sharing';

export function FolderDetailsPage() {
    const { folderId } = useParams<{ folderId: string }>();
    const { user } = useAuth(); // For metadata display
    const [folder, setFolder] = useState<SecureFolder | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('files');

    // Note State
    const [noteContent, setNoteContent] = useState('');

    // File State
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- NEW: Image Popup State ---
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Sharing State
    const [expiration, setExpiration] = useState('24');

    useEffect(() => {
        if (folderId) docService.getFolderDetails(folderId).then(setFolder);
    }, [folderId]);

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteContent.trim() || !folderId) return;
        const geo = await getCurrentPosition();
        const newNote = await docService.addNote(folderId, noteContent, geo?.lat, geo?.lng);
        setFolder((prev) => prev ? { ...prev, notes: [newNote, ...(prev.notes || [])] } : null);
        setNoteContent('');
    };

    const handleDeleteFile = async (fileId: string) => {
        if (!folderId || !window.confirm("Are you sure you want to delete this file?")) return;

        try {
            await docService.deleteFile(folderId, fileId);
            setFolder((prev) => prev ? {
                ...prev,
                files: prev.files?.filter(f => f.id !== fileId)
            } : null);
        } catch (err) {
            alert("Failed to delete the file.");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !folderId) return;
        if (file.size > 20 * 1024 * 1024) return alert('File must be smaller than 20MB');

        setUploading(true);
        const geo = await getCurrentPosition();
        try {
            const newFile = await docService.uploadFile(folderId, file, geo?.lat, geo?.lng);
            setFolder((prev) => prev ? { ...prev, files: [newFile, ...(prev.files || [])] } : null);
        } catch (err) {
            alert('Upload failed.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleShare = async () => {
        if (!folderId) return;
        const res = await docService.shareFolder(folderId, expiration);
        prompt('Shareable read-only link generated:', res.shareUrl);
    };

    if (!folder) return <div className="p-10 text-slate-500">Loading folder data...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-10 font-sans">

            {/* BREADCRUMB */}
            <Link to="/docs" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition-colors">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                My Documents
            </Link>

            {/* HEADER AREA */}
            <div className="flex items-start justify-between mb-8">
                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{folder.name}</h1>
                        <p className="text-sm font-medium text-slate-500 mb-1">{folder.crisisId || 'General Crisis Evidence'}</p>
                        <p className="text-sm text-slate-600 max-w-xl">{folder.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-xs font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Private
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-slate-200 mb-8 gap-6">
                {[
                    { id: 'files', label: 'Files', count: folder.files?.length || 0, icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                    { id: 'notes', label: 'Notes', count: folder.notes?.length || 0, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                    { id: 'metadata', label: 'Metadata', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                    { id: 'sharing', label: 'Sharing', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`pb-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-blue-100' : 'bg-slate-100'}`}>{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: FILES */}
            {activeTab === 'files' && (
                <div className="space-y-6">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all flex flex-col items-center justify-center group"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/jpeg, image/png, image/webp, video/mp4, video/webm" />
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </div>
                        <p className="text-slate-900 font-medium mb-1">{uploading ? 'Uploading securely...' : 'Drag & drop files here'}</p>
                        {!uploading && <p className="text-blue-600 text-sm mb-3">or click to browse</p>}
                        <p className="text-xs text-slate-400 flex items-center justify-center gap-3">
                            <span>🖼️ JPG, PNG, WEBP</span>
                            <span>🎥 MP4, WEBM</span>
                            <span>⚖️ ≤ 20 MB</span>
                        </p>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Uploaded Files ({folder.files?.length || 0})</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {folder.files?.map(file => (
                                <div key={file.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
                                    <div
                                        className="h-32 bg-slate-50 border-b border-slate-100 flex items-center justify-center text-4xl overflow-hidden">
                                        {file.fileType.startsWith('image/') ? (
                                            <img
                                                src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${file.fileUrl}`}
                                                alt={file.fileName}
                                                // --- NEW: Added onClick and cursor-pointer to trigger the popup ---
                                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                                onClick={() => setSelectedImage(`${import.meta.env.VITE_API_URL?.replace('/api', '')}${file.fileUrl}`)}
                                            />
                                        ) : (
                                            '🎥'
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p className="text-sm font-medium text-slate-800 truncate"
                                           title={file.fileName}>{file.fileName}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-slate-500">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
                                            <button
                                                onClick={() => handleDeleteFile(file.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                                     viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: NOTES */}
            {activeTab === 'notes' && (
                <div className="space-y-6">
                    <form onSubmit={handleAddNote} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-3">Add Timestamped Note</h3>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
                            rows={4}
                            maxLength={2000}
                            placeholder="Document your operational observations, actions taken, or evidence descriptions..."
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            required
                        />
                        <div className="flex justify-between items-center mt-3">
                            <span className="text-xs text-slate-400">{noteContent.length}/2000</span>
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add Note
                            </button>
                        </div>
                    </form>

                    <div className="space-y-4">
                        {folder.notes?.map(note => (
                            <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
                                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 font-medium bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>{new Date(note.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</span>
                                    <span className="text-slate-300">|</span>
                                    <span>UTC: {new Date(note.createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
                                </div>
                                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: METADATA */}
            {activeTab === 'metadata' && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <h3 className="font-semibold text-slate-900">Folder Metadata</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {[
                            { label: 'Folder ID', value: folder.id },
                            { label: 'Created (UTC)', value: new Date(folder.createdAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' },
                            { label: 'Created (Local)', value: new Date(folder.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) },
                            { label: 'Last Modified (UTC)', value: new Date(folder.updatedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' },
                            { label: 'Uploader User ID', value: folder.ownerId },
                            { label: 'Linked Crisis', value: folder.crisisId || 'None assigned' },
                        ].map((row, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                                <span className="text-sm text-slate-500 w-1/3 mb-1 sm:mb-0">{row.label}</span>
                                <span className="text-sm font-medium text-slate-900 font-mono">{row.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: SHARING */}
            {activeTab === 'sharing' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex gap-4 items-start">
                            <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            </div>
                            <div>
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

                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex gap-4 items-start">
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

                                <button onClick={handleShare} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                                    Generate Shareable Link
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- NEW: FULLSCREEN IMAGE MODAL --- */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
                    onClick={() => setSelectedImage(null)} // Clicking outside closes it
                >
                    <div className="relative max-w-5xl w-full max-h-full flex items-center justify-center group">
                        {/* Close button that shows up top right */}
                        <button
                            className="absolute top-4 right-4 text-white hover:text-slate-200 bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors z-10"
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>

                        <img
                            src={selectedImage}
                            alt="Expanded view"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()} // Prevents closing when clicking the image itself
                        />
                    </div>
                </div>
            )}

        </div>
    );
}