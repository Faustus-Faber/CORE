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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
            onClick={onClose} // Clicking outside closes it
        >
            <div className="relative max-w-5xl w-full max-h-full flex items-center justify-center group">
                {/* Close button that shows up top right */}
                <button
                    className="absolute -top-12 right-0 text-white hover:text-slate-200 bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors z-10"
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
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Prevents closing when clicking the image itself
                    />
                ) : (
                    <video
                        src={selectedMedia}
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </div>
    );
};
