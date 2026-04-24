import React from 'react';
import { FolderFile } from '../../types';

interface FileSectionProps {
    files: FolderFile[];
    viewMode: 'grid' | 'list';
    setViewMode: (mode: 'grid' | 'list') => void;
    uploading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteFile: (fileId: string) => void;
    editingFileId: string | null;
    setEditingFileId: (id: string | null) => void;
    editDescription: string;
    setEditDescription: (desc: string) => void;
    handleUpdateFileDescription: (fileId: string) => void;
    handleScanFile?: (fileId: string) => void;
    scanningFileId?: string | null;
    setSelectedMedia: (url: string | null) => void;
    setSelectedMediaType: (type: 'image' | 'video' | null) => void;
    API_BASE: string;
    isReadOnly?: boolean;
}

export const FileSection: React.FC<FileSectionProps> = ({
    files,
    viewMode,
    setViewMode,
    uploading,
    fileInputRef,
    handleFileUpload,
    handleDeleteFile,
    editingFileId,
    setEditingFileId,
    editDescription,
    setEditDescription,
    handleUpdateFileDescription,
    handleScanFile,
    scanningFileId,
    setSelectedMedia,
    setSelectedMediaType,
    API_BASE,
    isReadOnly = false
}) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-900">Uploaded Files ({files.length})</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>
            </div>

            {!isReadOnly && (
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
            )}

            <div>
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {files.map(file => (
                            <div key={file.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow flex flex-col">
                                <div
                                    className="h-32 bg-slate-50 border-b border-slate-100 flex items-center justify-center text-4xl overflow-hidden">
                                    {file.fileType.startsWith('image/') ? (
                                        <img
                                            src={`${API_BASE}${file.fileUrl}`}
                                            alt={file.fileName}
                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                                            onClick={() => {
                                                setSelectedMedia(`${API_BASE}${file.fileUrl}`);
                                                setSelectedMediaType('image');
                                            }}
                                        />
                                    ) : (
                                        <div className="relative w-full h-full group/video">
                                            <video
                                                src={`${API_BASE}${file.fileUrl}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <div
                                                className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-colors cursor-pointer"
                                                onClick={() => {
                                                    setSelectedMedia(`${API_BASE}${file.fileUrl}`);
                                                    setSelectedMediaType('video');
                                                }}
                                            >
                                                <svg className="w-12 h-12 text-white opacity-80 group-hover/video:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex-grow flex flex-col">
                                    <p className="text-sm font-semibold text-slate-800 truncate mb-1" title={file.fileName}>
                                        {file.fileName}
                                    </p>
                                    {editingFileId === file.id && !isReadOnly ? (
                                        <div className="mt-1">
                                            <textarea
                                                className="w-full text-xs p-1.5 border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                rows={2}
                                                autoFocus
                                            />
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={() => handleUpdateFileDescription(file.id)} className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded">Save</button>
                                                <button onClick={() => setEditingFileId(null)} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p
                                            className={`text-xs text-slate-500 italic mb-2 line-clamp-2 ${!isReadOnly ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                            onClick={() => {
                                                if (!isReadOnly) {
                                                    setEditingFileId(file.id);
                                                    setEditDescription(file.description || '');
                                                }
                                            }}
                                        >
                                            {file.description || (isReadOnly ? '' : 'Add description...')}
                                        </p>
                                    )}

                                    <div className="mt-auto flex justify-between items-end pt-2 border-t border-slate-50">
                                        <div className="flex flex-col gap-0.5">
                                            <p className="text-[9px] text-slate-400">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
                                            <p className="text-[9px] text-slate-400">UID: {file.uploaderId}</p>
                                            <p className="text-[9px] text-slate-400" title="UTC">🕒 {new Date(file.createdAt).toISOString().replace('T', ' ').substring(0, 16)} UTC</p>
                                            {file.gpsLat && (
                                                <p className="text-[9px] text-blue-500 font-medium">📍 GPS: {file.gpsLat.toFixed(4)}, {file.gpsLng?.toFixed(4)}</p>
                                            )}
                                        </div>
                                        {!isReadOnly && (
                                            <div className="flex items-center gap-1">
                                                {file.fileType.startsWith('image/') && handleScanFile && (
                                                    <button
                                                        onClick={() => handleScanFile(file.id)}
                                                        disabled={scanningFileId === file.id}
                                                        className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                                                    >
                                                        {scanningFileId === file.id ? 'Scanning' : 'OCR'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteFile(file.id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Size</th>
                                    <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                                    {!isReadOnly && <th className="px-4 py-3"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {files.map(file => (
                                    <tr key={file.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 overflow-hidden rounded bg-slate-50 flex items-center justify-center shrink-0">
                                                    {file.fileType.startsWith('image/') ? (
                                                        <img
                                                            src={`${API_BASE}${file.fileUrl}`}
                                                            alt=""
                                                            className="w-full h-full object-cover cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedMedia(`${API_BASE}${file.fileUrl}`);
                                                                setSelectedMediaType('image');
                                                            }}
                                                        />
                                                    ) : (
                                                        <span
                                                            className="text-xl cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedMedia(`${API_BASE}${file.fileUrl}`);
                                                                setSelectedMediaType('video');
                                                            }}
                                                        >
                                                            🎥
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-medium text-slate-800 truncate max-w-[150px]" title={file.fileName}>{file.fileName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingFileId === file.id && !isReadOnly ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        className="text-xs p-1 border border-blue-300 rounded"
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                    />
                                                    <button onClick={() => handleUpdateFileDescription(file.id)} className="text-blue-600 font-bold">✓</button>
                                                </div>
                                            ) : (
                                                <span
                                                    className={`text-slate-500 text-xs truncate max-w-[200px] block ${!isReadOnly ? 'cursor-pointer' : ''}`}
                                                    onClick={() => {
                                                        if (!isReadOnly) {
                                                            setEditingFileId(file.id);
                                                            setEditDescription(file.description || '');
                                                        }
                                                    }}
                                                >
                                                    {file.description || (isReadOnly ? '' : '-')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(file.createdAt).toLocaleDateString()}</td>
                                        {!isReadOnly && (
                                            <td className="px-4 py-3 text-right">
                                                {file.fileType.startsWith('image/') && handleScanFile && (
                                                    <button
                                                        onClick={() => handleScanFile(file.id)}
                                                        disabled={scanningFileId === file.id}
                                                        className="mr-2 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                                                    >
                                                        {scanningFileId === file.id ? 'Scanning' : 'OCR'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteFile(file.id)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
