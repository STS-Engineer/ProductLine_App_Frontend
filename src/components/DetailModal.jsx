import React, { useState, useEffect, useRef } from 'react';
import { Save, X, FileText, Loader } from 'lucide-react';
import Swal from 'sweetalert2';
import { EXCLUDED_INTERNAL_COLUMNS, FIELD_SUGGESTION_ENDPOINTS } from '../config/collections';
import { getFieldType } from '../utils/fields';
import FieldInput from './FieldInput';
import FilePreview from './FilePreview';
import FileInputButton from './FileInputButton';

const DetailModal = ({ isOpen, onClose, item, activeCollection, allProductLines, handleUpdate, isLoading, setApiError, authToken }) => {
    const [formData, setFormData] = useState(item);
    const [isEditing, setIsEditing] = useState(item.id === undefined || item.id === null);
    useEffect(() => {
        // Reset form data when item changes or modal opens
        setFormData({
            ...item,
            // Ensure numeric values are numbers for input type='number'
            gmdc_pct: item.gmdc_pct ? parseFloat(item.gmdc_pct) : 0.00,
            // Ensure file fields are arrays for consistency (even if the DB returns null/string)
            attachments_raw: Array.isArray(item.attachments_raw) ? item.attachments_raw : (item.attachments_raw ? [item.attachments_raw] : []),
            product_pictures: Array.isArray(item.product_pictures) ? item.product_pictures : (item.product_pictures ? [item.product_pictures] : []),
        });
        setIsEditing(item.id === undefined || item.id === null);
    }, [item, isOpen]);

    const modalRef = useRef(null);

    // Parent (App.jsx) passes an inline onClose, a new function reference on every keystroke in
    // the form (its state update re-renders the parent). Reading it through a ref keeps the
    // effect below from re-running — and re-stealing focus via modalNode.focus() — on every
    // keystroke; it should only run once when the modal actually opens.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    // Escape-to-close + Tab focus trap, standard modal keyboard behavior
    useEffect(() => {
        if (!isOpen) return;

        const modalNode = modalRef.current;
        const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

        modalNode?.focus();

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onCloseRef.current();
                return;
            }
            if (e.key === 'Tab' && modalNode) {
                const focusable = modalNode.querySelectorAll(focusableSelector);
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleFieldChange = (field, value) => {
        // Correct handler for modal inputs
        const finalValue = field === 'gmdc_pct' ? parseFloat(value) : (field === 'prod_if_customer_in_china' ? value : value);
        setFormData(prev => ({ ...prev, [field]: finalValue }));
    };

    const handleFileChange = (field, fileOrFiles) => {
        if (Array.isArray(fileOrFiles)) {
            const existingPaths = formData[field].filter(f => typeof f === 'string');
            const previouslyStagedFiles = formData[field].filter(f => f instanceof File);
            const newFiles = fileOrFiles.filter(f => f instanceof File);

            setFormData(prev => ({
                ...prev,
                [field]: [
                    ...existingPaths,        // Keep already-uploaded files
                    ...previouslyStagedFiles, // Keep files picked earlier this session, not yet uploaded
                    ...newFiles              // Add newly picked files
                ]
            }));
        } else {
             setFormData(prev => ({ ...prev, [field]: [] }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const requiredCheck = activeCollection.requiredFields.every(field => {
            const value = formData[field];
            if (getFieldType(field).includes('file')) {
                 return activeCollection.requiredFields.includes(field) ? Array.isArray(value) && value.length > 0 : true;
            }
            return activeCollection.requiredFields.includes(field) ? !!value : true;
        });

        if (!requiredCheck) {
            Swal.fire('Validation Error', `Missing required fields: ${activeCollection.requiredFields.filter(field => {
                const value = formData[field];
                return getFieldType(field).includes('file') ? Array.isArray(value) && value.length === 0 : !value;
            }).join(', ')}`, 'warning');
            return;
        }

        handleUpdate(formData.id, formData);
    };

    const isProduct = activeCollection.name === 'Products';
    const hasPendingFiles = Object.values(formData).some(v => Array.isArray(v) && v.some(f => f instanceof File));

    const renderInput = (field, label, type, isRequired) => {
        const currentValue = formData[field] || ''; // Can be string (path) or File object

        // Read-through display: view mode shows plain text/rich-text, not boxed inputs — inputs
        // only appear once "Modify" is clicked. A field the Users config marks as non-editable
        // (e.g. email, display_name) stays in this read view even while editing something else.
        const isReadOnlyDisplay = !isEditing || (activeCollection.editableFields && !activeCollection.editableFields.includes(field));

        if (type !== 'file_image' && type !== 'file_attachment' && isReadOnlyDisplay) {
            return (
                <div className={type === 'textarea' ? "col-span-full" : undefined}>
                    <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-1">{label}</p>
                    {type === 'textarea' ? (
                        currentValue ? (
                            <div
                                className="text-sm text-[#333333] leading-relaxed [&_p]:mb-2 last:[&_p]:mb-0"
                                dangerouslySetInnerHTML={{ __html: currentValue }}
                            />
                        ) : (
                            <p className="text-sm text-[#8A8A8A] italic">N/A</p>
                        )
                    ) : type === 'checkbox' ? (
                        <p className="text-sm text-[#333333]">{currentValue ? 'Yes' : 'No'}</p>
                    ) : (
                        <p className="text-sm text-[#333333]">{currentValue !== '' ? String(currentValue) : <span className="text-[#8A8A8A] italic">N/A</span>}</p>
                    )}
                </div>
            );
        }

        if (type === 'file_image' || type === 'file_attachment') {
            const isImage = type === 'file_image';
            const fileDataArray = Array.isArray(formData[field]) ? formData[field] : []; // Now always an array

            const existingPaths = fileDataArray.filter(f => typeof f === 'string');
            const newFiles = fileDataArray.filter(f => f instanceof File);

            const hasExistingPaths = existingPaths.length > 0;
            const hasNewFiles = newFiles.length > 0;
            const hasData = hasExistingPaths || hasNewFiles;


            const handleFileSelect = (e) => {
                const files = Array.from(e.target.files);
                handleFileChange(field, files);
                e.target.value = null;
            };

            const handleRemoveFile = (indexToRemove, isNewFile) => {
                if (isNewFile) {
                    const updatedNewFiles = newFiles.filter((_, index) => index !== indexToRemove);
                    setFormData(prev => ({
                        ...prev,
                        [field]: [...existingPaths, ...updatedNewFiles]
                    }));
                } else {
                    const updatedExistingPaths = existingPaths.filter((_, index) => index !== indexToRemove);
                    setFormData(prev => ({
                        ...prev,
                        [field]: [...updatedExistingPaths, ...newFiles]
                    }));
                }
            };

            const wrapperClass = isImage
                ? "relative flex flex-col items-center col-span-full max-w-sm mx-auto"
                : "relative flex flex-col col-span-full";
            const previewLayoutClass = "mt-2 flex flex-wrap justify-center gap-3";

            // Previews below always render per-file by actual extension (image -> <img>,
            // office/pdf -> <iframe>, see FilePreview) regardless of which button added the file —
            // the file_attachment case's two buttons only change the OS picker's filter/label.
            const previews = (
                <>
                    {hasExistingPaths && (
                        <div className={previewLayoutClass}>
                            {existingPaths.map((path, index) => (
                                <div key={`path-${path}`} className="w-64">
                                    <FilePreview
                                        fileRef={path}
                                        fileName={path.substring(path.lastIndexOf('/') + 1)}
                                        onRemove={isEditing ? () => handleRemoveFile(index, false) : undefined}
                                        removeLabel="Remove (will delete on save)"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    {hasNewFiles && (
                        <div className={previewLayoutClass}>
                            {newFiles.map((file, index) => (
                                <div key={`new-${file.name}`} className="w-64">
                                    <FilePreview
                                        fileRef={file}
                                        fileName={file.name}
                                        onRemove={isEditing ? () => handleRemoveFile(index, true) : undefined}
                                        removeLabel="Cancel selection"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                    {!hasData && <p className="text-xs text-[#8A8A8A] mt-1 text-center">No files currently attached.</p>}
                </>
            );

            if (type === 'file_attachment') {
                return (
                    <div className="relative flex flex-col col-span-full">
                        <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-1">{label} {isRequired && isEditing && '*'}</p>
                        {isEditing && (
                            <div className="flex items-center justify-center gap-4">
                                <FileInputButton
                                    id={`modal-${field}-images`}
                                    isImage={true}
                                    onChange={handleFileSelect}
                                    disabled={isLoading}
                                />
                                <div className="w-px self-stretch bg-[#C7C7C7]" aria-hidden="true" />
                                <FileInputButton
                                    id={`modal-${field}-files`}
                                    isImage={false}
                                    onChange={handleFileSelect}
                                    disabled={isLoading}
                                />
                            </div>
                        )}
                        {previews}
                    </div>
                );
            }

            return (
                <div className={wrapperClass}>
                    <p className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide mb-1 text-center">{label} {isRequired && isEditing && '*'}</p>
                    {isEditing && (
                        <FileInputButton
                            id={`modal-${field}`}
                            isImage={true}
                            onChange={handleFileSelect}
                            disabled={isLoading}
                        />
                    )}
                    {previews}
                </div>
            );
        }

        return (
            <FieldInput
                field={field}
                label={label}
                type={type}
                isRequired={isRequired}
                value={currentValue}
                onChange={(val) => handleFieldChange(field, val)}
                disabled={isLoading || !isEditing}
                idPrefix="modal"
                fieldOptions={activeCollection.fieldOptions && activeCollection.fieldOptions[field]}
                productLineOptions={isProduct && field === 'product_line' ? allProductLines : undefined}
                suggestionEndpoint={FIELD_SUGGESTION_ENDPOINTS[field]}
                authToken={authToken}
            />
        );
    };

    const displayFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));
    const imageFields = displayFields.filter(field => getFieldType(field) === 'file_image');
    const gridFields = displayFields.filter(field => field !== 'id' && !imageFields.includes(field));

    return (
        <div
            aria-hidden={!isOpen}
            className={`fixed inset-0 bg-gray-900 flex items-center justify-center p-4 z-50 transition-opacity duration-200 ${
                isOpen ? 'bg-opacity-75 opacity-100' : 'opacity-0 pointer-events-none'
            }`}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={`bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto outline-none transition-all duration-200 ${
                    isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
            >
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <div className="flex items-baseline gap-2 min-w-0">
                        <h2 className="text-2xl font-bold text-[#333333] truncate">
                            {item.id
                                ? (item[activeCollection.compactFields[0]] || activeCollection.name.slice(0, -1))
                                : `New ${activeCollection.name.slice(0, -1)}`}
                        </h2>
                        {item.id && (
                            <span className="text-xs text-[#C7C7C7] flex-shrink-0">ID: {String(item.id).substring(0, 8)}</span>
                        )}
                    </div>
                    {/* NEW: MODIFY / CLOSE BUTTON GROUP */}
                    <div className="flex space-x-3 items-center">

                        {/* 1. Modify Button (Visible when NOT editing AND item is existing) */}
                        {!isEditing && item.id && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition-all duration-150 flex items-center bg-[#ED7300] hover:bg-[#C25F00] hover:-translate-y-0.5 hover:shadow-md text-white"
                                disabled={isLoading}
                            >
                                <FileText className="w-5 h-5 mr-2" />
                                Modify
                            </button>
                        )}

                        {/* 2. Close Button */}
                        <button onClick={onClose} aria-label="Close" className="p-2 text-[#575757] hover:text-[#333333] rounded-full hover:bg-[#F4F6F8] transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {imageFields.map(field => {
                        const label = field.toUpperCase().replace(/_/g, ' ');
                        const isRequired = activeCollection.requiredFields.includes(field);
                        return (
                            <React.Fragment key={field}>
                                {renderInput(field, label, 'file_image', isRequired)}
                            </React.Fragment>
                        );
                    })}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {gridFields.map(field => {
                            const label = field.toUpperCase().replace(/_/g, ' ');
                            const type = getFieldType(field);
                            const isRequired = activeCollection.requiredFields.includes(field);

                            return (
                                <React.Fragment key={field}>
                                    {renderInput(field, label, type, isRequired)}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-[#C7C7C7] rounded-lg text-[#575757] hover:bg-[#F4F6F8] transition"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                       {/* SHOW SAVE BUTTON ONLY WHEN EDITING */}
                        {isEditing && (
                            <button
                                type="submit"
                                className="px-6 py-2 bg-[#ED7300] text-white font-semibold rounded-lg hover:bg-[#C25F00] hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                {isLoading ? (hasPendingFiles ? 'Uploading files and data...' : 'Saving...') : 'Save Changes'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DetailModal;
