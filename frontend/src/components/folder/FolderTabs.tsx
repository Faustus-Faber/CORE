import React from 'react';

export type Tab = 'files' | 'notes' | 'metadata' | 'sharing';

interface FolderTabsProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    counts: {
        files: number;
        notes: number;
    };
}

export const FolderTabs: React.FC<FolderTabsProps> = ({ activeTab, setActiveTab, counts }) => {
    const tabs = [
        { id: 'files', label: 'Files', count: counts.files, icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
        { id: 'notes', label: 'Notes', count: counts.notes, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { id: 'metadata', label: 'Metadata', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { id: 'sharing', label: 'Sharing', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' }
    ];

    return (
        <div className="mb-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-px sm:gap-6">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                    {tab.label}
                    {tab.count !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-blue-100' : 'bg-slate-100'}`}>{tab.count}</span>
                    )}
                </button>
            ))}
        </div>
    );
};
