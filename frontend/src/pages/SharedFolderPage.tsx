import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { docService } from '../services/docService';
import { SecureFolder } from '../types';
import { FolderTabs, Tab } from '../components/folder/FolderTabs';
import { FileSection } from '../components/folder/FileSection';
import { NoteSection } from '../components/folder/NoteSection';
import { MetadataSection } from '../components/folder/MetadataSection';
import { MediaModal } from '../components/folder/MediaModal';

export function SharedFolderPage() {
    const { token } = useParams<{ token: string }>();
    const [folder, setFolder] = useState<SecureFolder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('files');

    const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api").replace("/api", "");
    
    // Media Popup State
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
    const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | null>(null);

    // View State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        if (token) {
            docService.getSharedFolder(token)
                .then((data) => {
                    setFolder(data);
                    setLoading(false);
                })
                .catch((err) => {
                    const message = err instanceof Error ? err.message : "This shared link is invalid or has expired.";
                    setError(message);
                    setLoading(false);
                });
        }
    }, [token]);

    if (loading) return <div className="p-10 text-slate-500 text-center">Loading shared content...</div>;
    
    if (error || !folder) {
        return (
            <div className="max-w-2xl mx-auto p-10 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Link Expired or Invalid</h2>
                <p className="text-slate-600">{error || "The link you're trying to access is no longer available."}</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-4 font-sans sm:p-6 md:p-10">
             {/* HEADER AREA (Read-only version) */}
             <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                        <h1 className="break-words text-2xl font-bold text-slate-900">{folder.name}</h1>
                        <p className="text-sm font-medium text-slate-500 mb-1">Shared Content</p>
                        <p className="text-sm text-slate-600 max-w-xl">{folder.description}</p>
                        <p className="text-xs text-slate-400 mt-2">Owner: {folder.owner?.fullName || 'Confidential'}</p>
                    </div>
                </div>
                <div className="flex w-fit items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Read Only
                </div>
            </div>

            <FolderTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                counts={{
                    files: folder.files?.length || 0,
                    notes: folder.notes?.length || 0
                }}
            />

            {activeTab === 'files' && (
                <FileSection
                    files={folder.files || []}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    uploading={false}
                    fileInputRef={{ current: null }}
                    handleFileUpload={() => {}}
                    handleDeleteFile={() => {}}
                    editingFileId={null}
                    setEditingFileId={() => {}}
                    editDescription=""
                    setEditDescription={() => {}}
                    handleUpdateFileDescription={() => {}}
                    setSelectedMedia={setSelectedMedia}
                    setSelectedMediaType={setSelectedMediaType}
                    API_BASE={API_BASE}
                    isReadOnly={true}
                />
            )}

            {activeTab === 'notes' && (
                <NoteSection
                    notes={folder.notes || []}
                    noteContent=""
                    setNoteContent={() => {}}
                    handleAddNote={() => {}}
                    handleDeleteNote={() => {}}
                    isReadOnly={true}
                />
            )}

            {activeTab === 'metadata' && (
                <MetadataSection folder={folder} />
            )}

            {selectedMedia && selectedMediaType && (
                <MediaModal
                    selectedMedia={selectedMedia}
                    selectedMediaType={selectedMediaType}
                    onClose={() => {
                        setSelectedMedia(null);
                        setSelectedMediaType(null);
                    }}
                />
            )}
        </div>
    );
}
