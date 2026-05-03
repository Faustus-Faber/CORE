import React from 'react';
import { Link } from 'react-router-dom';
import { SecureFolder } from '../../types';

interface FolderHeaderProps {
    folder: SecureFolder;
}

export const FolderHeader: React.FC<FolderHeaderProps> = ({ folder }) => {
    return (
        <>
            {/* BREADCRUMB */}
            <Link to="/docs" className="inline-flex items-center text-sm text-slate-500 hover:text-blue-600 mb-6 transition-colors">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                My Documents
            </Link>

            {/* HEADER AREA */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div className="min-w-0">
                        <h1 className="break-words text-2xl font-bold text-slate-900">{folder.name}</h1>
                        <p className="text-sm font-medium text-slate-500 mb-1">{folder.crisisId || 'General Crisis Evidence'}</p>
                        <p className="text-sm text-slate-600 max-w-xl">{folder.description}</p>
                    </div>
                </div>
                <div className="flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Private
                </div>
            </div>
        </>
    );
};
