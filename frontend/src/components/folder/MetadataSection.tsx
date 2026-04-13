import React from 'react';
import { SecureFolder } from '../../types';

interface MetadataSectionProps {
    folder: SecureFolder;
}

export const MetadataSection: React.FC<MetadataSectionProps> = ({ folder }) => {
    const metadataRows = [
        { label: 'Folder ID', value: folder.id },
        { label: 'Created (UTC)', value: new Date(folder.createdAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' },
        { label: 'Created (Local)', value: new Date(folder.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) },
        { label: 'Last Modified (UTC)', value: new Date(folder.updatedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' },
        { label: 'Owner Name', value: folder.owner?.fullName || 'Unknown' },
        { label: 'Uploader User ID', value: folder.ownerId },
        { label: 'Linked Crisis', value: folder.crisisId || 'None assigned' },
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="font-semibold text-slate-900">Folder Metadata</h3>
            </div>
            <div className="divide-y divide-slate-100">
                {metadataRows.map((row, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                        <span className="text-sm text-slate-500 w-1/3 mb-1 sm:mb-0">{row.label}</span>
                        <span className="text-sm font-medium text-slate-900 font-mono">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
