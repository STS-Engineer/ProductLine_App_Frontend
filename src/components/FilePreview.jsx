import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { BASE_API_URL } from '../config/collections';
import { IMAGE_EXTENSIONS_REGEX, OFFICE_EXTENSIONS_REGEX } from '../config/constants';

// Always-visible inline preview for an uploaded (or about-to-be-uploaded) file — no click
// required. fileRef is either an existing server path/URL (string) or a not-yet-uploaded
// File object.
const FilePreview = ({ fileRef, fileName, onRemove, removeLabel }) => {
    const isNewFile = fileRef instanceof File;

    // Object URL is created *inside* the effect (not useMemo) so creation and its matching
    // revoke are always paired. Under StrictMode's dev-only mount->cleanup->remount cycle, a
    // useMemo'd URL gets revoked by the synthetic cleanup before the <img> ever loads it — this
    // way, the remount simply creates a second, still-valid URL that the img actually uses.
    const [objectUrl, setObjectUrl] = useState(null);
    useEffect(() => {
        if (!isNewFile) return undefined;
        const url = URL.createObjectURL(fileRef);
        setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [fileRef, isNewFile]);

    const resolvedUrl = isNewFile
        ? objectUrl
        : (fileRef.startsWith('http') ? fileRef : `${BASE_API_URL}/${fileRef}`);

    const isImageFile = IMAGE_EXTENSIONS_REGEX.test(fileName);
    const isOfficeFile = OFFICE_EXTENSIONS_REGEX.test(fileName);
    const isPdfFile = /\.pdf$/i.test(fileName);

    let body;
    if (isNewFile && !resolvedUrl) {
        // One-render gap before the effect above creates the object URL
        body = <div className="w-full h-28 rounded-lg border border-[#C7C7C7] bg-[#F4F6F8] animate-pulse" />;
    } else if (isImageFile) {
        body = (
            <img
                src={resolvedUrl}
                alt={fileName}
                className="w-full max-h-64 object-contain rounded-lg border border-[#C7C7C7] bg-[#F4F6F8]"
            />
        );
    } else if (isPdfFile && isNewFile) {
        // Unlike other office formats, browsers render a PDF blob: URL natively — no Google Docs
        // Viewer (and no public URL) needed, so this can preview before upload.
        body = (
            <iframe
                src={resolvedUrl}
                title={fileName}
                className="w-full h-64 border border-[#C7C7C7] rounded-lg"
            />
        );
    } else if (isOfficeFile && isNewFile) {
        // Google Docs Viewer can't fetch a local blob: URL — no publicly reachable URL exists
        // yet for a file that hasn't been uploaded, so a live iframe here would just be broken.
        body = (
            <div className="w-full h-28 flex items-center justify-center text-center px-4 rounded-lg border border-[#C7C7C7] bg-[#F4F6F8] text-sm text-[#8A8A8A]">
                Preview available after upload
            </div>
        );
    } else if (isOfficeFile) {
        const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(resolvedUrl)}&embedded=true`;
        body = (
            <iframe
                src={viewerUrl}
                title={fileName}
                className="w-full h-64 border border-[#C7C7C7] rounded-lg"
                sandbox="allow-scripts allow-popups allow-forms"
            />
        );
    } else {
        body = (
            <div className="w-full flex items-center justify-center rounded-lg border border-[#C7C7C7] bg-[#F4F6F8] px-3 py-6 text-sm text-[#8A8A8A] text-center">
                {isNewFile ? (
                    'Preview not available for this file type'
                ) : (
                    <a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-[#0071B8] hover:text-[#0A4B78] font-medium">
                        Open in new tab to preview
                    </a>
                )}
            </div>
        );
    }

    return (
        <div>
            {body}
            <div className="flex justify-between items-center mt-1 gap-2">
                <span className="text-xs text-[#8A8A8A] truncate">{fileName}</span>
                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-[#C62828] hover:text-[#a02020] transition p-1 flex-shrink-0"
                        title={removeLabel || 'Remove'}
                        aria-label={removeLabel || `Remove ${fileName}`}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default FilePreview;
