import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LogOut, Plus, Trash2, Save, X, Clock, Filter, Database, User, Mail, Zap, Loader, ChevronDown, Eye, Shield, FileText } from 'lucide-react'; 
import Swal from "sweetalert2"; 
import logoAvocarbon from './assets/logo-avocarbon.png';

// IMPORTANT: Update this to your deployed API server URL when moving off localhost
const BASE_API_URL = 'https://product-db-back.azurewebsites.net';

// List of columns managed by the server/database that should NOT be shown in forms or tables
const EXCLUDED_INTERNAL_COLUMNS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'password_hash', 'product_line_id'];
const CHARACTER_EXPANSION_THRESHOLD = 30; // Threshold for long text fields in the modal

// --- Data Model Configuration based on PostgreSQL schema ---
const initialCollections = {
    product_lines: {
        name: 'Product Lines',
        apiPath: '/api/product_lines',
        filterableFields: ['name', 'product_line_manager'],
        fields: ['id', 'name', 'type_of_products', 'manufacturing_locations', 'design_center', 'product_line_manager', 'history', 'type_of_customers', 'metiers', 'strength', 'weakness', 'perspectives', 'compliance_resource_id', 'attachments_raw', ...EXCLUDED_INTERNAL_COLUMNS],
        compactFields: [ 'name', 'product_line_manager'],
        requiredFields: ['name', 'product_line_manager' ],
        defaultValues: { name: '', type_of_products: '', product_line_manager: '', strength: '', weakness: '', attachments_raw: [] }, 
        placeholder: { name: 'Engine Line X', type_of_products: 'Automotive', product_line_manager: 'Jane Doe' },
    },
    products: {
        name: 'Products',
        apiPath: '/api/products',
        filterableFields: ['product_name', 'product_line'],
        fields: ['id', 'product_name', 'product_line', 'description', 'product_definition', 'operating_environment', 'technical_parameters', 'machines_and_tooling', 'manufacturing_strategy', 'purchasing_strategy', 'prototypes_ppap_and_sop', 'engineering_and_testing', 'capacity', 'our_advantages', 'gmdc_pct', 'product_line_id', 'customers_in_production', 'customer_in_development', 'level_of_interest_and_why', 'estimated_price_per_product', 'prod_if_customer_in_china', 'costing_data', 'product_pictures', ...EXCLUDED_INTERNAL_COLUMNS],
        compactFields: [ 'product_name', 'product_line'],
        requiredFields: ['product_name', 'product_line'],
        defaultValues: { product_name: '', product_line: '', description: '', capacity: '', gmdc_pct: 0.00, product_pictures: [] }, 
        placeholder: { product_name: 'Sensor A1', product_line: 'Engine Line X', capacity: 'Unlimited/on demand...', gmdc_pct: 35.50 },
    },
    // MOCK user collection for display/role purposes
    users: {
        name: 'Users',
        apiPath: '/api/users',
        filterableFields: ['email', 'displayName', 'user_role'],
        fields: ['id', 'email', 'displayName', 'user_role', ...EXCLUDED_INTERNAL_COLUMNS],
        compactFields: ['displayName', 'email', 'user_role'],
        requiredFields: ['email', 'password', 'displayName'],
        defaultValues: { email: '', displayName: '', user_role: 'user' },
        placeholder: { email: 'name.lastname@avocarbon.com', displayName: 'Firstname Lastname' },
    },
};

const collectionKeys = Object.keys(initialCollections).filter(k => k !== 'users'); // Exclude users from main tabs
const LOGS_API_PATH = '/api/audit_logs';

// Initial column widths for resizing (used to initialize state)
const initialCompactFields = initialCollections.product_lines.compactFields.concat(initialCollections.products.compactFields).filter((v, i, a) => a.indexOf(v) === i);
const initialColumnWidths = initialCompactFields.reduce((acc, field) => {
    acc[field] = 200; // Default width in pixels
    return acc;
}, { 
    'id': 100, 
    'Details': 120,
    // NEW: Default widths for audit log table columns
    'Action': 80,
    'User': 150,
    'Table': 150,
    'Record ID': 100,
    'Timestamp': 220,
}); 

// --- Utility Functions ---

const formatTimestamp = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return 'Invalid Date';
    }
};

const getFieldType = (field) => {
    if (field.includes('history') || field.includes('description') || field.includes('strategy')|| field.includes('capacity') || field.includes('parameters') || field.includes('tooling') || field.includes('advantages') || field.includes('costing_data') || field.includes('definition') || field.includes('environment') || field.includes('locations') || field.includes('center') || field.includes('metiers') || field.includes('strength') || field.includes('weakness') || field.includes('perspectives') || field.includes('customers') || field.includes('prototypes_ppap_and_sop') || field.includes('engineering_and_testing') || field.includes('type_of_products')) return 'textarea';
    if (field.includes('gmdc_pct') || field.includes('estimated_price') ) return 'number';
    if (field.includes('prod_if_customer_in_china')) return 'checkbox';
    // File/Image fields now map to the new file handling logic
    if (field.includes('product_pictures')) return 'file_image';
    if (field.includes('attachments_raw')) return 'file_attachment';

    return 'text';
};

// --- HELPER COMPONENT: RESIZABLE TABLE HEADER (UNCHANGED, BUT REUSED) ---
const ResizableTableHeader = ({ columns, columnWidths, setColumnWidths, actionColumnTitle = 'Details' }) => {
    const startResizing = useCallback((e, colKey) => {
        e.preventDefault();
        const startX = e.clientX;
        const currentWidth = columnWidths[colKey] || 200;
        
        const mouseMoveHandler = (moveEvent) => {
            const widthChange = moveEvent.clientX - startX;
            // Limit minimum column width to prevent collapse
            const newWidth = Math.max(50, currentWidth + widthChange); 
            
            setColumnWidths(prev => ({ 
                ...prev, 
                [colKey]: newWidth 
            }));
        };

        const mouseUpHandler = () => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    }, [columnWidths, setColumnWidths]);
    
    // Convert column keys to display names
    const displayColumns = columns.map(field => ({
        key: field,
        title: field.toUpperCase().replace(/_/g, ' ')
    }));
    
    // Special handling for Audit Logs which use static titles that match the keys in initialColumnWidths
    const isAuditLogHeader = columns.some(c => ['Action', 'User', 'Table', 'Record ID', 'Timestamp'].includes(c));
    
    return (
        <thead className="bg-gray-50">
            <tr>
                {displayColumns.map(({ key, title }) => (
                    <th 
                        key={key} 
                        // Use key directly for width lookups
                        style={{ width: columnWidths[key] || 'auto', minWidth: 50 }}
                        className="relative px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"
                    >
                        <div className="flex items-center justify-between h-full">
                            {title}
                            
                            {/* Resizer Handle */}
                            <div
                                className="absolute top-0 right-0 w-2 h-full cursor-col-resize opacity-0 group-hover:opacity-100 bg-gray-300 hover:bg-indigo-500 transition-opacity"
                                onMouseDown={(e) => startResizing(e, key)}
                                title="Drag to resize column"
                            />
                        </div>
                    </th>
                ))}
                {/* Fixed Action/Details column only for data tables */}
                {!isAuditLogHeader && (
                    <th style={{ width: 120, minWidth: 120 }} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {actionColumnTitle}
                    </th>
                )}
            </tr>
        </thead>
    );
};

// --- MODAL COMPONENT (UNCHANGED) ---

const DetailModal = ({ isOpen, onClose, item, activeCollection, allProductLines, handleUpdate, isLoading, setApiError }) => {
    const [formData, setFormData] = useState(item);
    const [expandedFields, setExpandedFields] = useState({});
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
        setExpandedFields({});
        setIsEditing(item.id === undefined || item.id === null);
    }, [item, isOpen]);

    if (!isOpen) return null;

    const handleFieldChange = (field, value) => {
        // Correct handler for modal inputs
        const finalValue = field === 'gmdc_pct' ? parseFloat(value) : (field === 'prod_if_customer_in_china' ? value : value);
        setFormData(prev => ({ ...prev, [field]: finalValue }));
    };
    
    const handleFileChange = (field, fileOrFiles) => {
        if (Array.isArray(fileOrFiles)) {
            const existingPaths = formData[field].filter(f => typeof f === 'string' && f.startsWith('uploads/'));
            const newFiles = fileOrFiles.filter(f => f instanceof File); 
            
            setFormData(prev => ({ 
                ...prev, 
                [field]: [
                    ...existingPaths, // Keep existing paths
                    ...newFiles      // Add new file objects
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

    const renderInput = (field, label, type, isRequired) => {
        const baseClass = "p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm w-full";
        const currentValue = formData[field] || ''; // Can be string (path) or File object
        const isLongText = type === 'textarea';

        
        if (isProduct && field === 'product_line') {
             return (
                 <div className="relative flex flex-col">
                     <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                     <select
                         value={currentValue}
                         onChange={(e) => handleFieldChange(field, e.target.value)}
                         required={isRequired}
                         className={`${baseClass} appearance-none pr-8`}
                         disabled={isLoading}
                     >
                         <option value="" disabled>-- Select a Product Line --</option>
                         {allProductLines.map(pl => (
                             <option key={pl.id} value={pl.name}>
                                 {pl.name}
                             </option>
                         ))}
                     </select>
                     <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 bottom-3 pointer-events-none" />
                 </div>
             );
        }

    if (isLongText) {
    const isEditingMode = isEditing; // Use the state variable from the previous fix
    const isCurrentlyExpanded = expandedFields[field];
    const rawValue = String(currentValue);
    const isContentLong = rawValue.length > CHARACTER_EXPANSION_THRESHOLD;
    
    // Set rows based on the expanded state. Always be 2 when collapsed.
    const rowCount = isCurrentlyExpanded ? 6 : 2;

    return (
        // Always span full width for long text fields
        <div key={field} className={`relative flex flex-col col-span-full`}> 
            <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
            
            <textarea
                rows={rowCount} // Controls the visible height
                value={rawValue}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                required={isRequired}
                className={`${baseClass} transition-all duration-200 
                  ${!isEditingMode ? 'bg-gray-50 text-gray-700' : ''} 
                  ${isCurrentlyExpanded ? 'overflow-y-auto' : 'overflow-hidden'}` // Force overflow-hidden when collapsed
                }
                disabled={isLoading || !isEditingMode} // Use the correct disabled state
            />
            
            {/* Show Expand button only if content is long */}
            {isContentLong && (
                <button 
                    type="button"
                    // Toggle the field's expansion state
                    onClick={() => setExpandedFields(prev => ({ ...prev, [field]: !prev[field] }))}
                    className="text-indigo-500 text-xs mt-1 self-start hover:text-indigo-700 transition"
                    disabled={isLoading}
                >
                    {isCurrentlyExpanded ? 'Collapse ▲' : 'Expand ▼'}
                </button>
            )}
        </div>
    );
        }
        
        if (type === 'file_image' || type === 'file_attachment') {
            const isImage = type === 'file_image';
            const fileDataArray = Array.isArray(formData[field]) ? formData[field] : []; // Now always an array
            
            const existingPaths = fileDataArray.filter(f => typeof f === 'string' && f.startsWith('uploads/'));
            const newFiles = fileDataArray.filter(f => f instanceof File);

            const hasExistingPaths = existingPaths.length > 0;
            const hasNewFiles = newFiles.length > 0;
            const hasData = hasExistingPaths || hasNewFiles;

            
            const handleFileSelect = (e) => {
                const files = Array.from(e.target.files); 
                handleFileChange(field, files); 
                e.target.value = null; 
            };
            
            const handleView = (fileUrl, fileName) => {
                const rawFileUrl = `${BASE_API_URL}/${fileUrl}`; 
                
                const isCommonImage = isImage && (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) !== null);
                
                const isOfficeFile = fileName.toLowerCase().match(/\.(docx|xlsx|pptx|doc|xls|ppt|pdf|csv)$/) !== null;

                let viewerUrl = rawFileUrl;
                let viewerNote = 'If the file doesn\'t display above, your browser may not support direct viewing of this file type.';
                
                if (isOfficeFile) {
                    viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(rawFileUrl)}&embedded=true`;
                    viewerNote = 'Microsoft Office files are being displayed via Google Docs Viewer.';
                }


                if (isCommonImage) {
                    Swal.fire({
                        title: `${label} Preview: ${fileName}`,
                        imageUrl: rawFileUrl,
                        imageAlt: label,
                        width: 800,
                        imageWidth: '90%', 
                        imageHeight: 'auto', 
                        padding: '1em',
                        showCloseButton: true,
                        showConfirmButton: false,
                        customClass: {
                            image: 'object-contain h-auto'
                        }
                    });
                } else {
                    Swal.fire({
                        title: `${label} Review: ${fileName}`,
                        html: `
                            <div style="width: 100%; height: 60vh; border: 1px solid #ccc; background-color: #eee;">
                                <iframe 
                                    src="${viewerUrl}" 
                                    style="width: 100%; height: 100%; border: none;" 
                                    title="${fileName} Viewer"
                                    sandbox="allow-scripts allow-popups allow-same-origin allow-forms"
                                >
                                </iframe>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                ${viewerNote} You can right-click the file in the viewer or <a href="${rawFileUrl}" target="_blank" download class="text-indigo-600 hover:text-indigo-800 font-semibold">click here to download it</a>.
                            </p>
                        `,
                        width: '90%', 
                        showCloseButton: true,
                        showConfirmButton: false,
                        customClass: {
                            container: 'swal2-container-large-iframe',
                            popup: 'swal2-popup-large',
                            title: 'text-lg',
                        },
                        allowOutsideClick: true,
                        allowEscapeKey: true,
                    });
                }
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
            
            return (
                <div className="relative flex flex-col col-span-full">
                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                    
                    {/* File Input */}
                    <input
                        type="file"
                        multiple 
                        accept={isImage ? "image/*" : "*/*"}
                        onChange={handleFileSelect}
                        key={hasData ? (hasNewFiles ? 'new-files' : 'path-files') : 'empty'} 
                        className={`${baseClass} p-1 text-sm file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100`}
                        disabled={isLoading}
                    />

                    {/* Display current files (Paths) */}
                    {hasExistingPaths && (
                        <div className="mt-2 border p-3 rounded-lg bg-gray-50">
                            <p className="text-xs font-semibold text-green-700 mb-2">Current {existingPaths.length} File(s) on Server:</p>
                            {existingPaths.map((path, index) => (
                                <div key={`path-${path}`} className="flex justify-between items-center text-xs py-1 border-b last:border-b-0">
                                    <span className="truncate max-w-[calc(100%-100px)]">{path}</span>
                                    <div className="flex space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => handleView(path, path.substring(path.lastIndexOf('/') + 1))}
                                            className="text-indigo-600 hover:text-indigo-800 transition p-1"
                                            title="View Loaded Data"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(index, false)} // Remove existing path
                                            className="text-red-600 hover:text-red-800 transition p-1"
                                            title="Remove Link (Will delete on save)"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Display newly selected files (File objects) */}
                    {hasNewFiles && (
                         <div className="mt-2 border p-3 rounded-lg bg-blue-50">
                            <p className="text-xs font-semibold text-blue-700 mb-2">New {newFiles.length} File(s) Selected (Will upload on save):</p>
                            {newFiles.map((file, index) => (
                                <div key={`new-${file.name}`} className="flex justify-between items-center text-xs py-1 border-b last:border-b-0">
                                    <span className="truncate max-w-[calc(100%-50px)]">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(index, true)} // Remove new file object
                                        className="text-red-600 hover:text-red-800 transition p-1"
                                        title="Cancel selection"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                         </div>
                    )}

                    {!hasData && <p className="text-xs text-gray-500 mt-1">No files currently attached.</p>}
                </div>
            );
        }

        if (type === 'checkbox') {
             return (
                 <div className="flex items-center space-x-2 p-2 col-span-full">
                     <input
                         type="checkbox"
                         id={`modal-${field}`}
                         checked={!!currentValue}
                         onChange={(e) => handleFieldChange(field, e.target.checked)}
                         className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                         disabled={isLoading}
                     />
                     <label htmlFor={`modal-${field}`} className="text-sm font-medium text-gray-700">{label}</label>
                 </div>
             );
        }

        return (
            <div className="relative flex flex-col">
                <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                <input
                    type={type}
                    step={type === 'number' ? '0.01' : 'any'}
                    value={currentValue}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    required={isRequired}
                    className={baseClass}
                    disabled={isLoading || !isEditing}
                />
            </div>
        );
    };

    const displayFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Eye className="w-5 h-5 mr-2 text-indigo-500" />
                        Edit/View: {item.id ? activeCollection.name.slice(0, -1) : ''} (ID: {item.id ? String(item.id).substring(0, 8) : 'N/A'})
                    </h2>
                    {/* NEW: MODIFY / CLOSE BUTTON GROUP */}
                    <div className="flex space-x-3 items-center">
                        
                        {/* 1. Modify Button (Visible when NOT editing AND item is existing) */}
                        {!isEditing && item.id && (
                            <button 
                                type="button" 
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition duration-150 flex items-center bg-yellow-600 hover:bg-yellow-700 text-white"
                                disabled={isLoading}
                            >
                                <FileText className="w-5 h-5 mr-2" />
                                Modify
                            </button>
                        )}
                        
                        {/* 2. Close Button */}
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {displayFields.filter(f => f !== 'id').map(field => {
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
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                       {/* SHOW SAVE BUTTON ONLY WHEN EDITING */}
                        {isEditing && (
                            <button
                                type="submit"
                                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                                Save Changes
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- AUTHENTICATION SCREEN (UNCHANGED) ---
const LoginScreen = ({ setAuthToken, setUserData, setIsLoading, isLoading }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayNameInput, setDisplayNameInput] = useState(''); 
    const [derivedDisplayName, setDerivedDisplayName] = useState(''); 
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [error, setError] = useState(null);

    // NEW LOGIC: Effect to derive displayName from email
    useEffect(() => {
        if (isSigningUp && email) {
            const match = email.match(/^([^.@]+)(?:\.([^@]+))?@/);
            
            let name = '';
            if (match) {
                const part1 = match[1] || '';
                const part2 = match[2] || '';

                const formatPart = (part) => part 
                    ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() 
                    : '';
                
                name = [formatPart(part1), formatPart(part2)].filter(Boolean).join(' ');
            }

            if (name.trim() === '' && email.includes('@')) {
                 name = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim();
            }
            
            setDerivedDisplayName(name.trim());
        } else {
            setDerivedDisplayName('');
        }
    }, [email, isSigningUp]);
    
    const finalDisplayName = isSigningUp && derivedDisplayName && displayNameInput === '' 
        ? derivedDisplayName 
        : displayNameInput;

    const handleAuth = async (endpoint, payload) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${BASE_API_URL}/api/auth/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.message && data.message.includes('secretOrPrivateKey')) {
                    throw new Error("Authentication failed. Backend JWT_SECRET not configured.");
                }
                throw new Error(data.message || `Authentication failed with status ${response.status}`);
            }
            
            setAuthToken(data.token);
            setUserData(data.user);
            sessionStorage.setItem('authToken', data.token);
            sessionStorage.setItem('userData', JSON.stringify(data.user));

        } catch (err) {
            console.error(`${endpoint} error:`, err);
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = (e) => {
        e.preventDefault();
        handleAuth('signup', { email, password, displayName: finalDisplayName }); 
    };

    const handleLogin = (e) => {
        e.preventDefault();
        handleAuth('login', { email, password });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 space-y-6">
                <h1 className="text-3xl font-bold text-center text-indigo-700 flex items-center justify-center">
                    <Database className="w-8 h-8 mr-2 text-indigo-500" />
                    {isSigningUp ? 'Create Account' : 'Products and ProductLines Data'}
                </h1>
                
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <form onSubmit={isSigningUp ? handleSignup : handleLogin} className="space-y-4">
                    {isSigningUp && (
                        <div className="relative">
                            <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/3 transform -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Display Name (Auto-Generated)"
                                value={finalDisplayName} 
                                onChange={(e) => setDisplayNameInput(e.target.value)} 
                                required={isSigningUp}
                                disabled={isLoading}
                                // MODIFICATION: Always apply grey style when signing up
                                className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-gray-200 text-gray-500"
                                readOnly={true} 
                            />
                            <p className="text-xs text-gray-500 mt-1 pl-10">
                                {derivedDisplayName 
                                    ? `Derived name: ${derivedDisplayName}. Start typing to override.`
                                    : 'Enter your work email first to auto-generate.'}
                            </p>
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setDisplayNameInput(''); 
                            }}
                            required
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="relative">
                        <Zap className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 flex items-center justify-center disabled:opacity-50 shadow-md shadow-indigo-300"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader className="w-5 h-5 animate-spin mr-2" />
                        ) : isSigningUp ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-600">
                    {isSigningUp ? (
                        <>
                            Already have an account?{' '}
                            <button onClick={() => {setIsSigningUp(false); setDisplayNameInput('');}} className="text-indigo-600 font-medium hover:text-indigo-800">
                                Log In
                            </button>
                        </>
                    ) : (
                        <>
                            Need an account?{' '}
                            <button onClick={() => {setIsSigningUp(true); setDisplayNameInput('');}} className="text-indigo-600 font-medium hover:text-indigo-800">
                                Sign Up
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};

// --- MAIN APPLICATION COMPONENT (UPDATED) ---
const App = () => {
    const [authToken, setAuthToken] = useState(sessionStorage.getItem('authToken'));
    const [userData, setUserData] = useState(() => {
        const storedUser = sessionStorage.getItem('userData');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const [items, setItems] = useState([]);
    const [allProductLines, setAllProductLines] = useState([]);
    const [logs, setLogs] = useState([]);
    const [activeCollectionKey, setActiveCollectionKey] = useState(collectionKeys[0]);
    
    const [newItemData, setNewItemData] = useState(initialCollections[activeCollectionKey].defaultValues);
    const [logFilterTerm, setLogFilterTerm] = useState('');
    const [itemFilterTerm, setItemFilterTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiError, setApiError] = useState(null);

    // NEW STATE: Column widths for adjustable table
    const [columnWidths, setColumnWidths] = useState(initialColumnWidths);
    // NEW STATE: Client-side cache for main data and product lines
    const [dataCache, setDataCache] = useState({
        product_lines: { data: [], timestamp: 0 },
        products: { data: [], timestamp: 0 },
        productLinesList: { data: [], timestamp: 0 }
    });
    
    // --- MODAL STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    // --- FORM STATE (NEW) ---
    const [isFormVisible, setIsFormVisible] = useState(false);

    // --- FILTER STATE ---
    const [activeFilterField, setActiveFilterField] = useState(null);
    
    const activeCollection = initialCollections[activeCollectionKey];

    // Check if the current user is an admin 
    const isAdmin = userData && userData.user_role === 'admin';

    // Handler for logout (made a useCallback to be stable dependency for fetchData)
    const handleLogout = useCallback(async () => {
        if (authToken) {
            try {
                await fetch(`${BASE_API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                    }
                });
                console.log("Logout action logged successfully.");
            } catch (error) {
                console.error("Failed to log out action on server:", error);
            }
        }
        
        setAuthToken(null);
        setUserData(null);
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userData');
        setItems([]);
        setLogs([]);
        // Clear cache on logout
        setDataCache({
            product_lines: { data: [], timestamp: 0 },
            products: { data: [], timestamp: 0 },
            productLinesList: { data: [], timestamp: 0 }
        });
    }, [authToken]);


    // Data Fetching (Simulates GET request to API)
    const fetchData = useCallback(async (isUserAction = false) => {
        if (!authToken || !userData) {
            setIsLoading(false);
            return;
        }
        
        if (isInitialLoad || isUserAction) { 
            setIsLoading(true);
        }
        setApiError(null);

        const currentTimestamp = Date.now();
        const cacheTTL = 300000; // Cache Time-To-Live: 5 minutes (300000ms)
        const cachedKey = activeCollectionKey;
        
        let shouldFetchMainData = isUserAction || !dataCache[cachedKey] || (currentTimestamp - dataCache[cachedKey].timestamp) > cacheTTL;
        let shouldFetchProductLines = isUserAction || !dataCache.productLinesList || (currentTimestamp - dataCache.productLinesList.timestamp) > cacheTTL;
        let shouldFetchLogs = isUserAction; 

        const fetchPromises = [];

        // Helper function to handle fetch and return null on non-critical error
        const safeFetch = async (url, options, errorMessage) => {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    const errorData = response.status !== 204 ? await response.json() : {};
                    throw new Error(errorData.message || errorMessage);
                }
                return response.json();
            } catch (error) {
                console.error(`Safe Fetch Error (${url}):`, error);
                setApiError(error.message);
                return []; 
            }
        };

        // 1. MAIN DATA Fetch
        if (shouldFetchMainData) {
            fetchPromises.push(
                safeFetch(`${BASE_API_URL}${activeCollection.apiPath}`, 
                    { headers: { Authorization: `Bearer ${authToken}` } },
                    `Failed to fetch ${activeCollection.name} data.`
                )
            );
        } else {
            fetchPromises.push(Promise.resolve(dataCache[cachedKey].data));
        }
        
        // 2. LOGS Fetch
        if (shouldFetchLogs || isInitialLoad) {
            fetchPromises.push(
                safeFetch(`${BASE_API_URL}${LOGS_API_PATH}`, 
                    { headers: { Authorization: `Bearer ${authToken}` } },
                    'Failed to fetch Audit Logs.'
                )
            );
        } else {
            fetchPromises.push(Promise.resolve(logs));
        }

        // 3. PRODUCT LINES Fetch
        if (shouldFetchProductLines) {
            fetchPromises.push(
                safeFetch(`${BASE_API_URL}${initialCollections.product_lines.apiPath}`, 
                    { headers: { Authorization: `Bearer ${authToken}` } },
                    'Failed to fetch Product Lines data.'
                )
            );
        } else {
            fetchPromises.push(Promise.resolve(dataCache.productLinesList.data));
        }


        try {
            const [fetchedItems, fetchedLogs, fetchedProductLines] = await Promise.all(fetchPromises);
            
            // 1. Update Main Data
            const finalItems = fetchedItems.length > 0 ? fetchedItems : (dataCache[cachedKey]?.data || []);
            setItems(finalItems);
            if (shouldFetchMainData && fetchedItems.length > 0) {
                setDataCache(prev => ({
                    ...prev,
                    [cachedKey]: { data: fetchedItems, timestamp: currentTimestamp }
                }));
            }
            
            // 2. Update Product Lines List
            const finalProductLines = fetchedProductLines.length > 0 ? fetchedProductLines : (dataCache.productLinesList?.data || []);
            setAllProductLines(finalProductLines);
            if (shouldFetchProductLines && fetchedProductLines.length > 0) {
                 setDataCache(prev => ({
                    ...prev,
                    productLinesList: { data: fetchedProductLines, timestamp: currentTimestamp }
                }));
            }

            // 3. Update Logs
            if (shouldFetchLogs || isInitialLoad) {
                setLogs(fetchedLogs);
            }
            
        } catch (error) {
            console.error("Critical error fetching data:", error);
            if (error.message.includes('Failed to fetch') || error.message.includes('Invalid or expired token')) {
                handleLogout(); 
                setApiError("Session expired or API unreachable. Please log in again.");
            } else {
                setApiError(error.message || "Failed to fetch data from API. Check server status.");
            }
        } finally {
            if (isInitialLoad || isUserAction) { 
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        }
    }, [activeCollectionKey, authToken, userData, isInitialLoad, activeCollection.apiPath, activeCollection.name, handleLogout, dataCache, logs]); 


    // Initial fetch and polling setup
   useEffect(() => {
    setNewItemData(initialCollections[activeCollectionKey].defaultValues);
    setIsFormVisible(false); // Hide form on collection switch
    
    // OPTIMIZATION: Display cached data immediately on tab switch if available
    const cachedKey = activeCollectionKey; // 'product_lines' or 'products'
    if (dataCache[cachedKey] && dataCache[cachedKey].data.length > 0) {
        // Set data instantly for responsive UI
        setItems(dataCache[cachedKey].data); 
        // Then, initiate a background fetch without showing the spinner
        fetchData(false); 
    } else {
        // If no cache (first time load), force a full fetch with spinner.
        fetchData(true);
    }
}, [activeCollectionKey, dataCache, fetchData]); 


    // --- CRUD Handlers (UNCHANGED) ---

    const handleRequest = async (method, path, body = null, successCallback = () => {}) => {
        if (!authToken) return;
        setIsLoading(true); 
        setApiError(null);

        const fileFields = ['attachments_raw', 'product_pictures'];
        
        const hasFile = body && fileFields.some(field => Array.isArray(body[field]) && body[field].some(f => f instanceof File)); 

        let headers = {};
        let requestBody = null;

        if (hasFile) {
            const formData = new FormData();
            
            for (const key in body) {
                if (fileFields.includes(key) && Array.isArray(body[key])) {
                    body[key].forEach(fileOrPath => {
                        if (fileOrPath instanceof File) {
                            formData.append(`${key}`, fileOrPath, fileOrPath.name); 
                        } else if (typeof fileOrPath === 'string' && fileOrPath.startsWith('uploads/')) {
                            formData.append(`${key}_retained`, fileOrPath); 
                        }
                    });
                }
                else if (!fileFields.includes(key) && body[key] !== null && key !== 'id') { 
                    formData.append(key, body[key]);
                }
            }
            headers = { 'Authorization': `Bearer ${authToken}` };
            requestBody = formData;
        } else {
            headers = { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            };
            const fileFields = ['attachments_raw', 'product_pictures'];
            const jsonBody = body ? Object.keys(body).reduce((acc, key) => {
                if (key !== 'id') {
                    if (fileFields.includes(key) && Array.isArray(body[key])) {
                        acc[key] = body[key].filter(f => typeof f === 'string' && f.startsWith('uploads/'));
                    } else {
                        acc[key] = body[key];
                    }
                }
                return acc;
            }, {}) : null;
            requestBody = jsonBody ? JSON.stringify(jsonBody) : null;
        }

        try {
            const response = await fetch(`${BASE_API_URL}${path}`, {
                method: method,
                headers: headers,
                body: requestBody,
            });

            if (!response.ok) {
                const errorData = response.status !== 204 ? await response.json() : {};
                throw new Error(errorData.message || `API call failed with status ${response.status}.`);
            }

            if (method === 'POST') {
                Swal.fire('Created!', `${activeCollection.name.slice(0, -1)} successfully created.`, 'success');
            } else if (method === 'PUT') {
                 Swal.fire('Updated!', `${activeCollection.name.slice(0, -1)} successfully updated.`, 'success');
            } else if (method === 'DELETE') {
                 Swal.fire('Deleted!', `${activeCollection.name.slice(0, -1)} permanently removed.`, 'success');
            }

            setDataCache(prev => ({
                ...prev,
                [activeCollectionKey]: { data: [], timestamp: 0 }, 
                productLinesList: { data: [], timestamp: 0 } 
            }));


            successCallback();
            fetchData(true); 

        } catch (error) {
            console.error(`Error during ${method} operation:`, error);
            Swal.fire('Error!', `${error.message}`, 'error');
            setApiError(error.message || "An unknown error occurred during API operation.");
        } finally {
            setIsLoading(false);
        }
    };


    const handleCreate = (e) => {
        e.preventDefault();
        
        const requiredCheck = activeCollection.requiredFields.every(field => {
            const value = newItemData[field];
            
            if (activeCollectionKey === 'products' && field === 'prod_if_customer_in_china') return true;
            
            if (getFieldType(field).includes('file')) {
                 return Array.isArray(value) && value.length > 0;
            }
            
            return !!value;
        });
        
        if (!requiredCheck) {
             setApiError(`Missing required fields: ${activeCollection.requiredFields.filter(field => {
                 const value = newItemData[field];
                 if (activeCollectionKey === 'products' && field === 'prod_if_customer_in_china') return false;
                 if (getFieldType(field).includes('file')) return Array.isArray(value) && value.length === 0;
                 return !value;
             }).join(', ')}`);
             return;
        }
        
        let itemToCreate = { ...newItemData };

        const allowedFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));
        
        const finalPayload = Object.keys(itemToCreate).reduce((acc, key) => {
            if (allowedFields.includes(key)) { 
                const value = itemToCreate[key];
                
                if (getFieldType(key).includes('file')) {
                    acc[key] = Array.isArray(value) ? value : [];
                } 
                else if (key === 'gmdc_pct' || key === 'estimated_price') {
                     acc[key] = parseFloat(value);
                } 
                else {
                    acc[key] = value;
                }
            }
            return acc;
        }, {});
        
        delete finalPayload.id; 

        handleRequest(
            'POST', 
            activeCollection.apiPath, 
            finalPayload, 
            () => { 
                setNewItemData(initialCollections[activeCollectionKey].defaultValues);
                setIsFormVisible(false); 
            }
        );
    };

    const handleUpdate = (id, formData) => {
        
        const allowedFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));
        
        const finalPayload = Object.keys(formData).reduce((acc, key) => {
            if (allowedFields.includes(key)) { 
                const value = formData[key];
                
                if (getFieldType(key).includes('file')) {
                    acc[key] = Array.isArray(value) ? value : [];
                } 
                else if (key === 'gmdc_pct' || key === 'estimated_price') {
                     acc[key] = parseFloat(value);
                }
                else {
                    acc[key] = value;
                }
            }
            return acc;
        }, {});

        handleRequest(
            'PUT', 
            `${activeCollection.apiPath}/${id}`, 
            finalPayload, 
            () => { 
                setModalData(null);
                setIsModalOpen(false);
            }
        );
    };

    const handleDelete = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `You are about to delete this ${activeCollection.name.slice(0, -1)}. This action is permanent and will be logged.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                handleRequest('DELETE', `${activeCollection.apiPath}/${id}`);
            }
        });
    };
    
    // --- UI State Handlers (UNCHANGED) ---

    const openModalForEdit = (item) => {
        const product_pictures = Array.isArray(item.product_pictures) ? item.product_pictures : (item.product_pictures ? [item.product_pictures] : []);
        const attachments_raw = Array.isArray(item.attachments_raw) ? item.attachments_raw : (item.attachments_raw ? [item.attachments_raw] : []);
        
        setModalData({
            ...item,
            product_pictures: (typeof item.product_pictures === 'string' && item.product_pictures.startsWith('[')) ? JSON.parse(item.product_pictures) : product_pictures,
            attachments_raw: (typeof item.attachments_raw === 'string' && item.attachments_raw.startsWith('[')) ? JSON.parse(item.attachments_raw) : attachments_raw,
        });
        setIsModalOpen(true);
    };

    const handleCollectionSwitch = (key) => {
        setActiveCollectionKey(key);
        setItemFilterTerm('');
        setActiveFilterField(null); 
        setIsFormVisible(false); 
    };
    
    const handleNewItemChange = (field, value) => {
        if (getFieldType(field).includes('file')) {
             setNewItemData(prev => ({ ...prev, [field]: value }));
             return;
        }
        
        const finalValue = field === 'gmdc_pct' ? parseFloat(value) : (field === 'prod_if_customer_in_china' ? value : value);
        setNewItemData(prev => ({ ...prev, [field]: finalValue }));
    };
    
    const cancelForm = () => {
        setNewItemData(initialCollections[activeCollectionKey].defaultValues);
        setIsFormVisible(false);
    };


    // --- Filtering Logic (Client-Side) (UNCHANGED) ---
    
    const uniqueFilterValues = useMemo(() => {
        if (!activeFilterField) return [];
        const values = items.map(item => item[activeFilterField]).filter(Boolean);
        return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
    }, [items, activeFilterField]);

    const filteredItems = useMemo(() => {
        const term = itemFilterTerm.toLowerCase().trim();
        let filtered = items;

        if (activeFilterField && term) {
            filtered = filtered.filter(item => 
                String(item[activeFilterField]).toLowerCase() === term
            );
        } else if (!activeFilterField && term) {
            const displayFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));

            filtered = filtered.filter(item => 
                displayFields.some(key => 
                    String(item[key]).toLowerCase().includes(term)
                )
            );
        }

        return filtered;
    }, [items, itemFilterTerm, activeFilterField, activeCollection.fields]);

    const filteredLogs = useMemo(() => {
        const term = logFilterTerm.toLowerCase().trim();
        if (!term) return logs;
        
        const excludedActions = ['LOGIN', 'LOGOUT']; 

        return logs.filter(log => !excludedActions.includes(log.action)).filter(log => 
            (log.action?.toLowerCase().includes(term)) ||
            (log.table_name?.toLowerCase().includes(term)) ||
            (log.user_name?.toLowerCase().includes(term)) ||
            (String(log.document_id)?.toLowerCase().includes(term))
        );
    }, [logs, logFilterTerm]);

    // --- Render Functions (UPDATED) ---
    
    const renderHeader = () => (
        <header className="bg-gray-800 p-4 shadow-lg flex justify-between items-center flex-wrap">
            <div className="flex items-center space-x-4">
                <img 
                    src={logoAvocarbon} 
                    alt="AVOCARBON Logo" 
                    className="h-10 w-auto object-contain mr-2" 
                    title="AVOCARBON"
                />
                <h1 className="text-2xl font-extrabold text-indigo-400 flex items-center">
                    Products and ProductLines StreamLine
                </h1>
            </div>
            <div className="text-right flex items-center space-x-4 mt-2 sm:mt-0">
                <span className="text-sm font-medium text-gray-300 truncate max-w-xs flex items-center">
                     {userData.displayName} 
                    {isAdmin && <Shield className="w-4 h-4 ml-2 text-yellow-400 inline" title="Administrator Access" />}
                </span>
                <button
                    onClick={handleLogout}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-150 shadow-md flex items-center text-sm font-semibold"
                >
                    <LogOut className="w-4 h-4 mr-1" />
                    Logout
                </button>
            </div>
        </header>
    );

    const renderItemForm = () => (
        <div className={`bg-white p-6 rounded-xl shadow-xl transition-all duration-300 ease-in-out overflow-hidden mt-6 ${isFormVisible ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0 p-0'}`}>
            <form onSubmit={handleCreate} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-700 mb-4">Add New {activeCollection.name.slice(0, -1)}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activeCollection.fields.filter(f => f !== 'id' && !EXCLUDED_INTERNAL_COLUMNS.includes(f)).map(field => {
                        const type = getFieldType(field);
                        const isRequired = activeCollection.requiredFields.includes(field);
                        const label = field.toUpperCase().replace(/_/g, ' ');
                        const baseClass = "p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm";
                        
                        if (activeCollectionKey === 'products' && field === 'product_line') {
                            return (
                                <div key={field} className="relative flex flex-col">
                                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                    <select
                                        value={newItemData[field] || ''}
                                        onChange={(e) => handleNewItemChange(field, e.target.value)}
                                        required={isRequired}
                                        className={`${baseClass} appearance-none pr-8`}
                                        disabled={isLoading}
                                    >
                                        <option value="" disabled>-- Select a Product Line --</option>
                                        {allProductLines.map(pl => (
                                            <option key={pl.id} value={pl.name}>
                                                {pl.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 bottom-3 pointer-events-none" />
                                </div>
                            );
                        }
                        if (type === 'file_image' || type === 'file_attachment') {
                            const isImage = type === 'file_image';
                            
                            const handleFileSelect = (e) => {
                                const files = Array.from(e.target.files); 
                                handleNewItemChange(field, files); 
                                e.target.value = null;  
                            };
                            
                            const currentFiles = Array.isArray(newItemData[field]) ? newItemData[field] : []; 
                            
                            return (
                                <div key={field} className="relative flex flex-col col-span-full">
                                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                    <input
                                        type="file"
                                        multiple 
                                        accept={isImage ? "image/*" : "*/*"}
                                        onChange={handleFileSelect}
                                        key={currentFiles.length > 0 ? 'new-files' : 'empty'} 
                                        className={`${baseClass} p-1 text-sm file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100`}
                                        disabled={isLoading}
                                    />
                                    {currentFiles.length > 0 && (
                                         <div className="flex justify-between items-center mt-1">
                                             <p className="text-xs text-blue-600">
                                                 New Files Selected: {currentFiles.length} file(s)
                                             </p>
                                             <button
                                                 type="button"
                                                 onClick={() => handleNewItemChange(field, [])} 
                                                 className="text-red-500 text-xs hover:text-red-700"
                                             >
                                                 Clear
                                             </button>
                                         </div>
                                    )}
                                    {currentFiles.length === 0 && <p className="text-xs text-gray-500 mt-1">No files currently selected.</p>}
                                </div>
                            );
                        }

                        if (type === 'textarea') {
                            return (
                                <div key={field} className="relative flex flex-col col-span-full sm:col-span-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                    <textarea
                                        rows="2"
                                        placeholder={activeCollection.placeholder[field] || label}
                                        value={newItemData[field] || ''}
                                        onChange={(e) => handleNewItemChange(field, e.target.value)}
                                        required={isRequired}
                                        className={`${baseClass}`}
                                        disabled={isLoading}
                                    />
                                </div>
                            );
                        }
                        if (type === 'checkbox') {
                             return (
                                 <div key={field} className="flex items-center space-x-2">
                                     <input
                                         type="checkbox"
                                         id={`new-${field}`}
                                         checked={!!newItemData[field]}
                                         onChange={(e) => handleNewItemChange(field, e.target.checked)}
                                         className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                         disabled={isLoading}
                                     />
                                     <label htmlFor={`new-${field}`} className="text-sm font-medium text-gray-700">{label}</label>
                                 </div>
                             );
                        }
                        
                        return (
                            <div key={field} className="relative flex flex-col">
                                 <label className="text-xs font-medium text-gray-500 mb-1">{label} {isRequired && '*'}</label>
                                <input
                                    type={type}
                                    step={type === 'number' ? '0.01' : 'any'}
                                    placeholder={activeCollection.placeholder[field] || label}
                                    value={newItemData[field] || ''}
                                    onChange={(e) => handleNewItemChange(field, e.target.value)}
                                    required={isRequired}
                                    className={baseClass}
                                    disabled={isLoading}
                                />
                            </div>
                        );
                    })}
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={cancelForm}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        disabled={isLoading}
                    >
                        <X className="w-5 h-5 mr-2 inline" /> Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition duration-150 flex items-center justify-center disabled:opacity-50 shadow-md"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        ) : (
                            <Save className="w-5 h-5 mr-2" />
                        )}
                        {isLoading ? 'Saving...' : `Save ${activeCollection.name.slice(0, -1)}`}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderItemsTable = () => (
        <div className="bg-white p-6 rounded-xl shadow-xl mt-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="2xl font-bold text-gray-800 flex items-center">
                    {activeCollection.name} Data
                    <span className="ml-2 text-sm font-medium text-indigo-500 p-1 bg-indigo-50 rounded-full">{items.length} items</span>
                </h2>
                
                <button
                    onClick={() => setIsFormVisible(prev => !prev)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition duration-150 flex items-center ${isFormVisible ? 'bg-gray-400 hover:bg-gray-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    disabled={isLoading}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {isFormVisible ? 'Collapse Form' : `Add New ${activeCollection.name.slice(0, -1)}`}
                </button>
            </div>
            
            {apiError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg my-4" role="alert">
                    <p className="font-bold">Data Error:</p>
                    <p className="text-sm">{apiError}</p>
                </div>
            )}
            
            <div className="flex space-x-2 mb-4">
                <div className="relative">
                    <select
                        onChange={(e) => {
                            const field = e.target.value;
                            setActiveFilterField(field === "" ? null : field);
                            setItemFilterTerm(""); 
                        }}
                        value={activeFilterField || ""}
                        className="appearance-none pr-8 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        disabled={isLoading}
                    >
                        <option value="">-- All Columns --</option>
                        {activeCollection.filterableFields.map(field => (
                            <option key={field} value={field}>
                                Filter by {field.toUpperCase().replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                    {activeFilterField ? (
                        <select
                            onChange={(e) => setItemFilterTerm(e.target.value)}
                            value={itemFilterTerm}
                            className="appearance-none pr-8 pl-8 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            disabled={isLoading}
                        >
                            <option value="">--- All {activeFilterField.toUpperCase().replace(/_/g, ' ')} ---</option>
                            {uniqueFilterValues.map(value => (
                                <option key={value} value={String(value).toLowerCase()}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            placeholder={`Search All Fields...`}
                            value={itemFilterTerm}
                            onChange={(e) => setItemFilterTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm w-full sm:w-48"
                            disabled={isLoading}
                        />
                    )}
                    <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>
            </div>
            
            {/* RESIZABLE TABLE DISPLAY */}
            <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                <ResizableTableHeader 
                    columns={activeCollection.compactFields} 
                    columnWidths={columnWidths}
                    setColumnWidths={setColumnWidths}
                />
                
                <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading && items.length === 0 ? (
                        <tr>
                            <td colSpan={activeCollection.compactFields.length + 1} className="px-4 py-4 text-center text-indigo-500">
                                <Loader className="w-5 h-5 animate-spin inline mr-2" /> Loading data from API...
                            </td>
                        </tr>
                    ) : filteredItems.length === 0 ? (
                        <tr>
                            <td colSpan={activeCollection.compactFields.length + 1} className="px-4 py-4 text-center text-gray-500">
                                No items found matching filter criteria.
                            </td>
                        </tr>
                    ) : (
                        filteredItems.map(item => (
                            <tr key={item.id} className={'hover:bg-gray-50'}>
                                {activeCollection.compactFields.map(field => {
                                    const type = getFieldType(field);
                                    
                                    return (
                                        <td 
                                            key={field} 
                                            // Apply dynamic width style to the cell
                                            style={{ width: columnWidths[field] || 'auto' }}
                                            className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 truncate overflow-hidden"
                                        >
                                            {field === 'id' ? String(item[field]).substring(0, 8) + '...' 
                                                : type === 'checkbox' ? (item[field] ? 'Yes' : 'No') 
                                                : String(item[field] || 'N/A')}
                                        </td>
                                    )})}
                                <td style={{ width: 120 }} className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                                    <button 
                                        onClick={() => openModalForEdit(item)} 
                                        className="text-indigo-600 hover:text-indigo-800 transition p-1 rounded-full hover:bg-indigo-100 disabled:opacity-50" 
                                        disabled={isLoading}
                                        title="View/Edit Details"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)} 
                                        className="text-red-600 hover:text-red-800 transition p-1 rounded-full hover:bg-red-100 disabled:opacity-50 ml-2" 
                                        disabled={isLoading}
                                        title="Delete Record"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    // --- AUDIT LOGS RENDER FUNCTION (UPDATED) ---
    const renderAuditLogs = () => {
        // Define the columns for the logs table using strings that match the columnWidths keys
        const logColumns = ['Action', 'User', 'Table', 'Record ID', 'Timestamp'];

        return (
            <div className="mt-8 bg-gray-50 p-6 rounded-xl shadow-xl overflow-x-auto">
                <div className="flex justify-between items-center mb-4 flex-wrap">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Clock className="w-6 h-6 mr-2 text-yellow-600" />
                        Audit Logs
                    </h2>
                    <div className="relative mt-2 sm:mt-0">
                        <input
                            type="text"
                            placeholder="Filter Logs (Action, User, or Table)"
                            value={logFilterTerm}
                            onChange={(e) => setLogFilterTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 shadow-sm w-full sm:w-64"
                            disabled={isLoading}
                        />
                        <Filter className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">Every user action is recorded here.</p>
                
                <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg">
                    {/* CRITICAL: Added style={{ tableLayout: 'fixed' }} for resizing to work */}
                    <table className="min-w-full divide-y divide-gray-300" style={{ tableLayout: 'fixed' }}>
                        
                        {/* Use ResizableTableHeader for Audit Logs */}
                        <ResizableTableHeader
                            columns={logColumns}
                            columnWidths={columnWidths}
                            setColumnWidths={setColumnWidths}
                            actionColumnTitle={null} // Audit logs don't have an action column
                        />
                        
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-4 text-center text-gray-500">
                                        No matching logs found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, index) => (
                                    <tr key={index} className="hover:bg-yellow-50">
                                        <td 
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Action'] }}
                                            className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${log.action === 'CREATE' ? 'text-green-600' : log.action === 'UPDATE' ? 'text-blue-600' : 'text-red-600'}`}
                                        >
                                            {log.action}
                                        </td>
                                        <td 
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['User'] }}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 font-medium"
                                        >
                                            {log.user_name || log.user_id}
                                        </td>
                                        <td 
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Table'] }}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-gray-500"
                                        >
                                            {log.table_name}
                                        </td>
                                        <td 
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Record ID'] }}
                                            className="px-4 py-2 whitespace-nowrap text-xs font-mono text-gray-500"
                                        >
                                            {String(log.document_id).substring(0, 8)}
                                        </td>
                                        <td 
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Timestamp'] }}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-gray-500"
                                        >
                                            {formatTimestamp(log.logged_at)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    
    // --- Signature and Branding Footer Component (UNCHANGED) ---
    const renderSignature = () => (
        <footer className="bg-gray-800 text-gray-400 py-4 mt-auto shadow-inner">
            <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-8">
                <div className="flex items-center space-x-3">
                     <img 
                        src={logoAvocarbon} 
                        alt="AVOCARBON Logo" 
                        className="h-10 w-auto object-contain mr-2" 
                        title="AVOCARBON"
                    />
                    <span className="text-sm font-light hidden sm:inline">
                        — Built for StreamLine Operations
                    </span>
                </div>

                <p className="text-xs">
                    © {new Date().getFullYear()} Products and ProductLines StreamLine. All rights reserved. | Version 1.2
                </p>
            </div>
        </footer>
    );


    if (!authToken || !userData) {
        return <LoginScreen 
            setAuthToken={setAuthToken} 
            setUserData={setUserData} 
            setIsLoading={setIsLoading} 
            isLoading={isLoading} 
        />;
    }

    return (
        <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
            {renderHeader()}
            
            <main className="p-4 sm:p-8 max-w-7xl mx-auto flex-grow w-full">
                
                {/* Collection Selector Tabs */}
                <div className="flex space-x-2 border-b border-gray-300 mb-6">
                    {collectionKeys.map(key => (
                        <button
                            key={key}
                            onClick={() => handleCollectionSwitch(key)}
                            className={`py-3 px-6 text-lg font-medium transition duration-150 rounded-t-lg ${
                                activeCollectionKey === key
                                    ? 'border-b-4 border-indigo-600 text-indigo-700 bg-white shadow-t'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            }`}
                            disabled={isLoading}
                        >
                            {initialCollections[key].name}
                        </button>
                    ))}
                </div>

                {renderItemForm()}
                
                {renderItemsTable()}

                {/* CONDITIONAL RENDERING BASED ON ROLE */}
                {isAdmin && renderAuditLogs()}

            </main>

            {/* Modal must be rendered outside the main content flow */}
            {modalData && (
                <DetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    item={modalData}
                    activeCollection={activeCollection}
                    allProductLines={allProductLines}
                    handleUpdate={handleUpdate}
                    isLoading={isLoading}
                    setApiError={setApiError}
                />
            )}
            
            {/* NEW: Application Signature Footer */}
            {renderSignature()} 
        </div>
    );
};

export default App;
