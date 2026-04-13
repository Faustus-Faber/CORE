import React from 'react';
import { FolderNote } from '../../types';

interface NoteSectionProps {
    notes: FolderNote[];
    noteContent: string;
    setNoteContent: (content: string) => void;
    handleAddNote: (e: React.FormEvent) => void;
    handleDeleteNote: (noteId: string) => void;
    isReadOnly?: boolean;
}

export const NoteSection: React.FC<NoteSectionProps> = ({
    notes,
    noteContent,
    setNoteContent,
    handleAddNote,
    handleDeleteNote,
    isReadOnly = false
}) => {
    return (
        <div className="space-y-6">
            {!isReadOnly && (
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
            )}

            <div className="space-y-4">
                {notes.map(note => (
                    <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors group relative">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    Author ID: {note.authorId}
                                </div>
                                {note.gpsLat && (
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-blue-600 mt-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        GPS: {note.gpsLat.toFixed(4)}, {note.gpsLng?.toFixed(4)}
                                    </div>
                                )}
                            </div>
                            {!isReadOnly && (
                                <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                                    title="Delete note"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-3 font-mono bg-slate-50 w-fit px-3 py-1 rounded-lg">
                            <span title="Local">{new Date(note.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</span>
                            <span className="text-slate-300">|</span>
                            <span title="UTC">{new Date(note.createdAt).toISOString().replace('T', ' ').substring(0, 16)} UTC</span>
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
