import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { docService } from '../services/docService';
import { SecureFolder } from '../types';

export function MyDocumentsPage() {
    const [folders, setFolders] = useState<SecureFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showTrash, setShowTrash] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [crisisId, setCrisisId] = useState<string>('');
    const [activeCrises, setActiveCrises] = useState<{ id: string, title: string }[]>([]);

    const fetchFolders = async (trash = false) => {
        setLoading(true);
        try {
            const data = await docService.getFolders(trash);
            setFolders(data);
            
            if (!trash) {
                const crises = await docService.getActiveCrises();
                setActiveCrises(crises);
            }
        } catch (err) {
            console.error("Failed to fetch folders", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders(showTrash);
    }, [showTrash]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        try {
            const newFolder = await docService.createFolder({ 
                name, 
                description, 
                crisisId: crisisId || null 
            });
            setFolders([newFolder, ...folders]);
            setName('');
            setDescription('');
            setCrisisId('');
            setIsModalOpen(false);
        } catch (err) {
            alert("Failed to create folder");
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        const isPermanent = showTrash;
        const msg = isPermanent 
            ? "Permanently delete this folder and all its contents? This cannot be undone."
            : "Move this folder to trash? It will be permanently deleted after 30 days.";
        
        if (!window.confirm(msg)) return;

        try {
            await docService.deleteFolder(folderId, isPermanent);
            setFolders(prev => prev.filter(f => f.id !== folderId));
        } catch (err) {
            alert("Failed to delete the folder.");
        }
    };

    const handleRestoreFolder = async (folderId: string) => {
        try {
            await docService.restoreFolder(folderId);
            setFolders(prev => prev.filter(f => f.id !== folderId));
        } catch (err) {
            alert("Failed to restore folder");
        }
    };

    const handleTogglePin = async (folderId: string) => {
        try {
            const updated = await docService.togglePin(folderId);
            setFolders(prev => prev.map(f => f.id === folderId ? updated : f)
                .sort((a, b) => {
                    if (a.isPinned === b.isPinned) return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                    return a.isPinned ? -1 : 1;
                })
            );
        } catch (err) {
            alert("Failed to toggle pin");
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
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {showTrash ? 'Trash Bin' : 'My Documents'}
                    </h1>
                    <p className="text-slate-500 text-sm">
                        {showTrash 
                            ? `${folders.length} items in trash`
                            : `${folders.length} secure folders · ${totalFiles} files`
                        }
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowTrash(!showTrash)}
                        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border shadow-sm ${
                            showTrash 
                            ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        {showTrash ? 'Exit Trash' : 'Trash'}
                    </button>
                    {!showTrash && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                            Create Secure Folder
                        </button>
                    )}
                </div>
            </div>

            {/* BADGE BAR */}
            <div className="flex gap-3 mb-8 text-xs font-medium overflow-x-auto pb-2">
                {showTrash ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full border border-orange-100 whitespace-nowrap">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Items in trash are deleted permanently after 30 days
                    </span>
                ) : (
                    <>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> All folders encrypted
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 whitespace-nowrap">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Private by default
                        </span>
                    </>
                )}
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
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4"></div>
                    <p className="text-slate-500 text-sm">Loading your secure workspace...</p>
                </div>
            ) : filteredFolders.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <h3 className="text-slate-900 font-semibold mb-1">No folders found</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                        {searchQuery ? 'Try adjusting your search query' : (showTrash ? 'Your trash is empty' : 'Create your first secure folder to start organizing evidence')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredFolders.map((folder) => (
                        <div key={folder.id} className={`group relative bg-white rounded-xl border p-5 transition-all ${folder.isPinned ? 'border-blue-400 shadow-sm ring-1 ring-blue-400/10' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-2">
                                    <Link to={`/docs/${folder.id}`} className={`${folder.isPinned ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'} p-2.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                    </Link>
                                    {folder.isPinned && (
                                        <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider h-fit mt-1">
                                            Pinned
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {!showTrash && (
                                        <button
                                            onClick={() => handleTogglePin(folder.id)}
                                            className={`p-1 transition-colors ${folder.isPinned ? 'text-blue-500 hover:text-blue-600' : 'text-slate-300 hover:text-blue-400'}`}
                                            title={folder.isPinned ? "Unpin folder" : "Pin folder"}
                                        >
                                            <svg className="w-5 h-5" fill={folder.isPinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                                        </button>
                                    )}
                                    {showTrash ? (
                                        <>
                                            <button
                                                onClick={() => handleRestoreFolder(folder.id)}
                                                className="text-slate-300 hover:text-green-500 p-1 transition-colors"
                                                title="Restore folder"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFolder(folder.id)}
                                                className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                                title="Delete permanently"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleDeleteFolder(folder.id)}
                                            className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                            title="Move to trash"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                                <Link to={`/docs/${folder.id}`}>
                                    <h3 className="font-semibold text-slate-900 mb-1 truncate">{folder.name}</h3>
                                    {folder.crisisId && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase tracking-tight mb-2">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Linked Crisis
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-500 mb-4 line-clamp-2 min-h-[2rem]">{folder.description || 'Secure evidence locker'}</p>

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-0.5">📁 {folder._count?.files || 0} files</span>
                                            <span className="flex items-center gap-0.5">📝 {folder._count?.notes || 0} notes</span>
                                        </div>
                                        <span title="Last Modified">🕒 {new Date(folder.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                </Link>
                        </div>
                    ))}
                </div>
            )}

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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Linked Crisis Event (Optional)</label>
                                    <select 
                                        value={crisisId} 
                                        onChange={(e) => setCrisisId(e.target.value)} 
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
                                    >
                                        <option value="">None</option>
                                        {activeCrises.map(c => (
                                            <option key={c.id} value={c.id}>{c.title}</option>
                                        ))}
                                    </select>
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