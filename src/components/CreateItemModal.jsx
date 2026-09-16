import React, { useEffect, useRef, useState } from 'react';
import { Plus, Save, X, Loader, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { EXCLUDED_INTERNAL_COLUMNS, FIELD_SUGGESTION_ENDPOINTS } from '../config/collections';
import { getFieldType } from '../utils/fields';
import FieldInput from './FieldInput';
import FilePreview from './FilePreview';
import FileInputButton from './FileInputButton';

const CreateItemModal = ({ isOpen, onClose, activeCollection, newItemData, onFieldChange, onSubmit, isLoading, allProductLines, authToken }) => {
    const modalRef = useRef(null);
    const [currentStep, setCurrentStep] = useState(0);

    // Parent components (App.jsx) don't memoize onClose, so it's a new function reference on
    // every keystroke in the form (its state update re-renders the parent). Reading it through a
    // ref keeps the effect below from re-running — and re-stealing focus via modalNode.focus() —
    // on every keystroke; it should only run once when the modal actually opens.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    // All fields not explicitly grouped into a step still get shown, in one trailing step,
    // so a field added to a collection's config is never silently dropped from the form.
    const displayFields = activeCollection.fields.filter(field => field !== 'id' && !EXCLUDED_INTERNAL_COLUMNS.includes(field));
    const configuredSteps = activeCollection.formSteps || [{ title: activeCollection.name, fields: displayFields }];
    const groupedFields = new Set(configuredSteps.flatMap(step => step.fields));
    const leftoverFields = displayFields.filter(field => !groupedFields.has(field));
    const steps = leftoverFields.length > 0
        ? [...configuredSteps, { title: 'Other', fields: leftoverFields }]
        : configuredSteps;

    const isLastStep = currentStep === steps.length - 1;
    const hasPendingFiles = Object.values(newItemData).some(v => Array.isArray(v) && v.some(f => f instanceof File));

    // Reset to step 1 every time the modal opens
    useEffect(() => {
        if (isOpen) setCurrentStep(0);
    }, [isOpen]);

    // Escape-to-close + Tab focus trap, matching DetailModal's keyboard behavior
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

    if (!isOpen) return null;

    const stepFields = steps[currentStep].fields.filter(field => displayFields.includes(field));
    const imageFieldsInStep = stepFields.filter(field => getFieldType(field) === 'file_image');
    const gridFieldsInStep = stepFields.filter(field => !imageFieldsInStep.includes(field));

    const currentStepMissingFields = () => steps[currentStep].fields.filter(field => {
        if (!activeCollection.requiredFields.includes(field)) return false;
        const value = newItemData[field];
        if (getFieldType(field).includes('file')) return !(Array.isArray(value) && value.length > 0);
        return !value;
    });

    const goNext = () => {
        const missing = currentStepMissingFields();
        if (missing.length > 0) return;
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    };

    const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const handleSubmit = (e) => {
        if (!isLastStep) {
            e.preventDefault();
            goNext();
            return;
        }
        onSubmit(e);
    };

    const renderField = (field) => {
        const type = getFieldType(field);
        const isRequired = activeCollection.requiredFields.includes(field);
        const label = field.toUpperCase().replace(/_/g, ' ');

        if (type === 'file_image' || type === 'file_attachment') {
            const currentFiles = Array.isArray(newItemData[field]) ? newItemData[field] : [];

            const handleFileSelect = (e) => {
                const files = Array.from(e.target.files);
                onFieldChange(field, [...currentFiles, ...files]);
                e.target.value = null;
            };

            // Previews below always render per-file by actual extension (image -> <img>,
            // office/pdf -> <iframe>, see FilePreview) regardless of which button added the file —
            // the two buttons below only change the OS picker's filter and label, not storage.
            const previewGrid = (
                currentFiles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                        {currentFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="w-64">
                                <FilePreview
                                    fileRef={file}
                                    fileName={file.name}
                                    onRemove={() => onFieldChange(field, currentFiles.filter((_, i) => i !== index))}
                                    removeLabel="Cancel selection"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[#8A8A8A] mt-1 text-center">No files currently selected.</p>
                )
            );

            if (type === 'file_attachment') {
                return (
                    <div key={field} className="relative flex flex-col col-span-full">
                        <label className="text-xs font-medium text-[#575757] mb-1">{label} {isRequired && '*'}</label>
                        <div className="flex items-center justify-center gap-4">
                            <FileInputButton
                                id={`new-${field}-images`}
                                isImage={true}
                                onChange={handleFileSelect}
                                disabled={isLoading}
                            />
                            <div className="w-px self-stretch bg-[#C7C7C7]" aria-hidden="true" />
                            <FileInputButton
                                id={`new-${field}-files`}
                                isImage={false}
                                onChange={handleFileSelect}
                                disabled={isLoading}
                            />
                        </div>
                        {previewGrid}
                    </div>
                );
            }

            return (
                <div key={field} className="relative flex flex-col items-center col-span-full max-w-sm mx-auto">
                    <label htmlFor={`new-${field}`} className="text-xs font-medium text-[#575757] mb-1 text-center">{label} {isRequired && '*'}</label>
                    <FileInputButton
                        id={`new-${field}`}
                        isImage={true}
                        onChange={handleFileSelect}
                        disabled={isLoading}
                    />
                    {currentFiles.length > 0 ? (
                        <div className="mt-2 flex flex-wrap justify-center gap-3">
                            {currentFiles.map((file, index) => (
                                <div key={`${file.name}-${index}`} className="w-64">
                                    <FilePreview
                                        fileRef={file}
                                        fileName={file.name}
                                        onRemove={() => onFieldChange(field, currentFiles.filter((_, i) => i !== index))}
                                        removeLabel="Cancel selection"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[#8A8A8A] mt-1">No files currently selected.</p>
                    )}
                </div>
            );
        }

        return (
            <FieldInput
                key={field}
                field={field}
                label={label}
                type={type}
                isRequired={isRequired}
                value={newItemData[field]}
                onChange={(val) => onFieldChange(field, val)}
                disabled={isLoading}
                idPrefix="new"
                placeholder={activeCollection.placeholder[field] || label}
                textareaContainerClassName="relative flex flex-col col-span-full"
                checkboxContainerClassName="flex items-center space-x-2 col-span-full"
                productLineOptions={field === 'product_line' ? allProductLines : undefined}
                suggestionEndpoint={FIELD_SUGGESTION_ENDPOINTS[field]}
                authToken={authToken}
            />
        );
    };

    return (
        <div
            aria-hidden={!isOpen}
            className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50"
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto outline-none flex flex-col"
            >
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-[#333333] flex items-center">
                        <Plus className="w-5 h-5 mr-2 text-[#0071B8]" />
                        Add New {activeCollection.name.slice(0, -1)}
                    </h2>
                    <button onClick={onClose} aria-label="Close" className="p-2 text-[#575757] hover:text-[#333333] rounded-full hover:bg-[#F4F6F8] transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Step indicator */}
                {steps.length > 1 && (
                    <div className="px-6 pt-5 pb-2">
                        <ol className="flex items-center">
                            {steps.map((step, index) => {
                                const isDone = index < currentStep;
                                const isActive = index === currentStep;
                                return (
                                    <li key={step.title} className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}>
                                        <div className="flex flex-col items-center">
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 transition-colors ${
                                                    isDone
                                                        ? 'bg-[#0071B8] border-[#0071B8] text-white'
                                                        : isActive
                                                            ? 'bg-[#ED7300] border-[#ED7300] text-white'
                                                            : 'bg-white border-[#C7C7C7] text-[#8A8A8A]'
                                                }`}
                                            >
                                                {isDone ? <Check className="w-4 h-4" /> : index + 1}
                                            </div>
                                            <span className={`mt-1 text-[11px] font-medium text-center whitespace-nowrap ${isActive ? 'text-[#0A4B78]' : 'text-[#8A8A8A]'}`}>
                                                {step.title}
                                            </span>
                                        </div>
                                        {index < steps.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-2 mb-4 ${isDone ? 'bg-[#0071B8]' : 'bg-[#C7C7C7]'}`} />
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-6 flex-1 flex flex-col">
                    <div className="space-y-6 flex-1">
                        {imageFieldsInStep.map(renderField)}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {gridFieldsInStep.map(renderField)}
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-[#C7C7C7] rounded-lg text-[#575757] hover:bg-[#F4F6F8] transition"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>

                        <div className="flex space-x-3">
                            {currentStep > 0 && (
                                <button
                                    type="button"
                                    onClick={goBack}
                                    className="px-5 py-2 border border-[#C7C7C7] rounded-lg text-[#575757] hover:bg-[#F4F6F8] transition flex items-center"
                                    disabled={isLoading}
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                </button>
                            )}

                            {!isLastStep ? (
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#0071B8] text-white font-semibold rounded-lg hover:bg-[#0A4B78] transition flex items-center"
                                    disabled={isLoading}
                                >
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-2 bg-[#ED7300] text-white font-semibold rounded-lg hover:bg-[#C25F00] hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 flex items-center justify-center disabled:opacity-50 disabled:hover:translate-y-0 shadow-md"
                                >
                                    {isLoading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                    {isLoading ? (hasPendingFiles ? 'Uploading files and data...' : 'Saving...') : `Save ${activeCollection.name.slice(0, -1)}`}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateItemModal;
