import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { docService } from '../services/docService';
import { scanDocumentFile } from '../services/api';
import { getCurrentPosition } from '../utils/geo';
import { SecureFolder, FolderFile } from '../types';
import { FolderHeader } from '../components/folder/FolderHeader';
import { FolderTabs, Tab } from '../components/folder/FolderTabs';
import { FileSection } from '../components/folder/FileSection';
import { NoteSection } from '../components/folder/NoteSection';
import { MetadataSection } from '../components/folder/MetadataSection';
import { SharingSection } from '../components/folder/SharingSection';
import { MediaModal } from '../components/folder/MediaModal';

export function FolderDetailsPage() {
    const { folderId } = useParams<{ folderId: string }>();
    const navigate = useNavigate();
    const [folder, setFolder] = useState<SecureFolder | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('files');

    // Note State
    const [noteContent, setNoteContent] = useState('');

    // File State
    const [uploading, setUploading] = useState(false);
    const [scanningFileId, setScanningFileId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:5000/api").replace("/api", "");
    
    // Media Popup State
    const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
    const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | null>(null);

    // View State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editDescription, setEditDescription] = useState('');

    // Sharing State
    const [expiration, setExpiration] = useState('24');
    const [shareUrl, setShareUrl] = useState<string | null>(null);

    useEffect(() => {
        if (folderId) docService.getFolderDetails(folderId).then((data) => {
            setFolder(data);
            if (data.shareLinks && data.shareLinks.length > 0) {
                const baseUrl = window.location.origin;
                setShareUrl(`${baseUrl}/shared/${data.shareLinks[0].token}`);
            }
        });
    }, [folderId]);

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteContent.trim() || !folderId) return;
        try {
            const geo = await getCurrentPosition();
            const newNote = await docService.addNote(folderId, noteContent, geo?.lat, geo?.lng);
            setFolder((prev) => prev ? { ...prev, notes: [newNote, ...(prev.notes || [])] } : null);
            setNoteContent('');
        } catch (err) {
            alert("Failed to add note");
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!folderId) return;
        try {
            await docService.deleteNote(folderId, noteId);
            setFolder(prev => prev ? { ...prev, notes: prev.notes?.filter(n => n.id !== noteId) } : null);
        } catch (err) {
            alert("Failed to delete note");
        }
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

    const handleUpdateFileDescription = async (fileId: string) => {
        if (!folderId) return;
        try {
            const updated = await docService.updateFileDescription(folderId, fileId, editDescription);
            setFolder((prev) => {
                if (!prev) return null;
                const updatedFiles = prev.files?.map(f => f.id === fileId ? updated : f) as FolderFile[];
                return {
                    ...prev,
                    files: updatedFiles
                };
            });
            setEditingFileId(null);
        } catch (err) {
            alert("Failed to update description");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !folderId) return;
        if (file.size > 20 * 1024 * 1024) return alert('File must be smaller than 20MB');

        setUploading(true);
        try {
            const geo = await getCurrentPosition();
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
        try {
            const res = await docService.shareFolder(folderId, expiration);
            setShareUrl(res.shareUrl);
            alert(`Shareable read-only link generated: ${res.shareUrl}`);
        } catch (err) {
            alert("Failed to generate share link");
        }
    };

    const handleScanFile = async (fileId: string) => {
        if (!folderId) return;
        setScanningFileId(fileId);
        try {
            const { scan } = await scanDocumentFile(folderId, fileId);
            navigate('/ocr', { state: { scanId: scan.id } });
        } catch (err) {
            alert(err instanceof Error ? err.message : "OCR scan failed");
        } finally {
            setScanningFileId(null);
        }
    };

    const handleRevoke = async () => {
        if (!folderId || !window.confirm("Revoke all active share links for this folder?")) return;
        try {
            await docService.revokeShare(folderId);
            setShareUrl(null);
            alert("All share links revoked.");
        } catch (err) {
            alert("Failed to revoke share link");
        }
    };

    if (!folder) return <div className="p-10 text-slate-500">Loading folder data...</div>;

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-10 font-sans">
            <FolderHeader folder={folder} />

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
                    uploading={uploading}
                    fileInputRef={fileInputRef}
                    handleFileUpload={handleFileUpload}
                    handleDeleteFile={handleDeleteFile}
                    editingFileId={editingFileId}
                    setEditingFileId={setEditingFileId}
                    editDescription={editDescription}
                    setEditDescription={setEditDescription}
                    handleUpdateFileDescription={handleUpdateFileDescription}
                    handleScanFile={handleScanFile}
                    scanningFileId={scanningFileId}
                    setSelectedMedia={setSelectedMedia}
                    setSelectedMediaType={setSelectedMediaType}
                    API_BASE={API_BASE}
                />
            )}

            {activeTab === 'notes' && (
                <NoteSection
                    notes={folder.notes || []}
                    noteContent={noteContent}
                    setNoteContent={setNoteContent}
                    handleAddNote={handleAddNote}
                    handleDeleteNote={handleDeleteNote}
                />
            )}

            {activeTab === 'metadata' && (
                <MetadataSection folder={folder} />
            )}

            {activeTab === 'sharing' && (
                <SharingSection
                    expiration={expiration}
                    setExpiration={setExpiration}
                    shareUrl={shareUrl}
                    handleShare={handleShare}
                    handleRevoke={handleRevoke}
                />
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
