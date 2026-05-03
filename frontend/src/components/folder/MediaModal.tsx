import React from 'react';

interface MediaModalProps {
    selectedMedia: string;
    selectedMediaType: 'image' | 'video';
    onClose: () => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
    selectedMedia,
    selectedMediaType,
    onClose
}) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 backdrop-blur-sm sm:p-4"
            onClick={onClose} // Clicking outside closes it
        >
            <div className="group relative flex max-h-full w-full max-w-5xl items-center justify-center">
                {/* Close button that shows up top right */}
                <button
                    className="absolute right-2 top-2 z-10 rounded-full bg-black/40 p-2 text-white transition-colors hover:bg-black/60 hover:text-slate-200 sm:-top-12 sm:right-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {selectedMediaType === 'image' ? (
                    <img
                        src={selectedMedia}
                        alt="Expanded view"
                        className="max-h-[calc(100dvh-1rem)] max-w-full rounded-lg object-contain shadow-2xl sm:max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()} // Prevents closing when clicking the image itself
                    />
                ) : (
                    <video
                        src={selectedMedia}
                        className="max-h-[calc(100dvh-1rem)] max-w-full rounded-lg shadow-2xl sm:max-h-[90vh]"
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </div>
    );
};
