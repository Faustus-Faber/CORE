import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { docService } from '../services/docService';
import { SecureFolder } from '../types';

export function MyDocumentsPage() {
    const [folders, setFolders] = useState<SecureFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        docService.getFolders().then((data) => {
            // Only show folders that aren't soft-deleted
            setFolders(data.filter(f => !f.isDeleted));
            setLoading(false);
        });
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        const newFolder = await docService.createFolder({ name, description });
        setFolders([newFolder, ...folders]);
        setName('');
        setDescription('');
        setIsModalOpen(false);
    };

    const handleDeleteFolder = async (folderId: string) => {
        // Requirement: Deletion moves items to a 30-day trash
        if (!window.confirm("Move this folder to trash? It will be permanently deleted after 30 days.")) return;

        try {
            await docService.deleteFolder(folderId);
            // Instantly remove from the UI list
            setFolders(prev => prev.filter(f => f.id !== folderId));
        } catch (err) {
            alert("Failed to delete the folder.");
        }
    };

    const filteredFolders = folders.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalFiles = folders.reduce((acc, f) => acc + (f._count?.files || 0), 0);

    if (loading) return <div className="p-8 text-slate-500 text-center">Loading your secure workspace...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 md:p-10 font-sans">
            {/* HEADER */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">My Documents</h1>
                    <p className="text-slate-500 text-sm">
                        {folders.length} secure folders · {totalFiles} files · 46.4 MB total
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                    Create Secure Folder
                </button>
            </div>

            {/* BADGE BAR */}
            <div className="flex gap-3 mb-8 text-xs font-medium overflow-x-auto pb-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> All folders encrypted
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 whitespace-nowrap">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Private by default
                </span>
            </div>

            {/* SEARCH */}
            <div className="relative mb-8">
                <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                    type="text"
                    placeholder="Search folders..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* FOLDER GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredFolders.map((folder) => (
                    <div key={folder.id} className="group relative bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <Link to={`/docs/${folder.id}`} className="bg-blue-50 text-blue-600 p-2.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            </Link>
                            {/* DELETE BUTTON: Separated from the card Link */}
                            <button
                                onClick={() => handleDeleteFolder(folder.id)}
                                className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>

                        <Link to={`/docs/${folder.id}`}>
                            <h3 className="font-semibold text-slate-900 mb-1 truncate">{folder.name}</h3>
                            <p className="text-xs text-slate-500 mb-4 truncate">{folder.description || 'Secure evidence locker'}</p>

                            <div className="flex items-center gap-3 text-xs text-slate-500 pt-4 border-t border-slate-100">
                                <span className="flex items-center gap-1">📁 {folder._count?.files || 0} files</span>
                                <span className="flex items-center gap-1">📅 {new Date(folder.createdAt).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>

            {/* MODAL (Unchanged logic) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900">Create Secure Folder</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Folder Name * (Max 80 chars)</label>
                                    <input type="text" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="e.g., Downtown Evidence" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description (Max 500 chars)</label>
                                    <textarea maxLength={500} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Operational notes..." />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">Create Folder</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}