import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Clock, Filter, ChevronDown, ChevronRight, Loader, X } from 'lucide-react';
import Swal from "sweetalert2";
import { BASE_API_URL, EXCLUDED_INTERNAL_COLUMNS, initialCollections, collectionKeys, LOGS_API_PATH, initialColumnWidths } from './config/collections';
import { ADMIN_ROLE, CACHE_TTL_MS } from './config/constants';
import { formatTimestamp, getFieldType, stripHtml } from './utils/fields';
import ResizableTableHeader from './components/ResizableTableHeader';
import DetailModal from './components/DetailModal';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import CreateItemModal from './components/CreateItemModal';

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
    const [activeView, setActiveView] = useState(collectionKeys[0]); // collection key, or 'logs'

    const [newItemData, setNewItemData] = useState(initialCollections[activeCollectionKey].defaultValues);
    const [logFilterTerm, setLogFilterTerm] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
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
    // Mirrors so fetchData can read latest dataCache/logs without them in its dependency array
    // (both are written by fetchData itself, which would otherwise redefine on every fetch).
    const dataCacheRef = useRef(dataCache);
    useEffect(() => { dataCacheRef.current = dataCache; }, [dataCache]);
    const logsRef = useRef(logs);
    useEffect(() => { logsRef.current = logs; }, [logs]);

    // --- MODAL STATE ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    // --- FORM STATE (NEW) ---
    const [isFormVisible, setIsFormVisible] = useState(false);

    // --- FILTER STATE ---
    // Keyed by each filter's config `key`. Value shape depends on its `type`:
    // select/text-contains -> string, boolean -> 'all'|'yes'|'no', range -> { min, max } strings.
    const [structuredFilters, setStructuredFilters] = useState({});

    const activeCollection = initialCollections[activeCollectionKey];

    // Check if the current user is an admin
    const isAdmin = userData && userData.user_role === ADMIN_ROLE;
    const visibleCollectionKeys = isAdmin ? [...collectionKeys, 'users'] : collectionKeys;

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
        const cacheTTL = CACHE_TTL_MS;
        const cachedKey = activeCollectionKey;
        
        const dataCacheNow = dataCacheRef.current;
        let shouldFetchMainData = isUserAction || !dataCacheNow[cachedKey] || (currentTimestamp - dataCacheNow[cachedKey].timestamp) > cacheTTL;
        let shouldFetchProductLines = isUserAction || !dataCacheNow.productLinesList || (currentTimestamp - dataCacheNow.productLinesList.timestamp) > cacheTTL;
        let shouldFetchLogs = isUserAction;

        const fetchPromises = [];

        // Helper function to handle fetch and return null on non-critical error.
        // Only a 401 (invalid/expired session) forces logout — other failures just show an error.
        const safeFetch = async (url, options, errorMessage) => {
            try {
                const response = await fetch(url, options);
                if (response.status === 401) {
                    handleLogout();
                    throw new Error('Session expired. Please log in again.');
                }
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
            fetchPromises.push(Promise.resolve(dataCacheNow[cachedKey].data));
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
            fetchPromises.push(Promise.resolve(logsRef.current));
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
            fetchPromises.push(Promise.resolve(dataCacheNow.productLinesList.data));
        }


        try {
            const [fetchedItems, fetchedLogs, fetchedProductLines] = await Promise.all(fetchPromises);

            // 1. Update Main Data
            const finalItems = fetchedItems.length > 0 ? fetchedItems : (dataCacheNow[cachedKey]?.data || []);
            setItems(finalItems);
            if (shouldFetchMainData && fetchedItems.length > 0) {
                setDataCache(prev => ({
                    ...prev,
                    [cachedKey]: { data: fetchedItems, timestamp: currentTimestamp }
                }));
            }

            // 2. Update Product Lines List
            const finalProductLines = fetchedProductLines.length > 0 ? fetchedProductLines : (dataCacheNow.productLinesList?.data || []);
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
            setApiError(error.message || "Failed to fetch data from API. Check server status.");
        } finally {
            if (isInitialLoad || isUserAction) {
                setIsLoading(false);
                setIsInitialLoad(false);
            }
        }
    }, [activeCollectionKey, authToken, userData, isInitialLoad, activeCollection.apiPath, activeCollection.name, handleLogout]);


    // Initial fetch and polling setup
   useEffect(() => {
    setNewItemData(initialCollections[activeCollectionKey].defaultValues);
    setIsFormVisible(false); // Hide form on collection switch

    // OPTIMIZATION: Display cached data immediately on tab switch if available.
    // Reads dataCacheRef (not the dataCache state) and excludes dataCache from the dependency
    // array below — otherwise, a tab whose fetch never succeeds (so its cache entry never
    // populates) would re-trigger this effect every time any other cache entry changes
    // (e.g. the product lines list refreshing), causing an infinite refetch loop.
    const cachedKey = activeCollectionKey; // 'product_lines' or 'products'
    const cached = dataCacheRef.current[cachedKey];
    if (cached && cached.data.length > 0) {
        // Set data instantly for responsive UI
        setItems(cached.data);
        // Then, initiate a background fetch without showing the spinner
        fetchData(false);
    } else {
        // If no cache (first time load), force a full fetch with spinner.
        fetchData(true);
    }
}, [activeCollectionKey, fetchData]);


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
                        } else if (typeof fileOrPath === 'string') {
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
                        acc[key] = body[key].filter(f => typeof f === 'string');
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
        setSearchTerm('');
        setStructuredFilters({});
        setIsFormVisible(false);
    };

    const fetchLogs = useCallback(async () => {
        if (!authToken) return;
        setIsLoading(true);
        setApiError(null);
        try {
            const response = await fetch(`${BASE_API_URL}${LOGS_API_PATH}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (response.status === 401) {
                handleLogout();
                return;
            }
            if (!response.ok) {
                const errorData = response.status !== 204 ? await response.json() : {};
                throw new Error(errorData.message || 'Failed to fetch Audit Logs.');
            }
            setLogs(await response.json());
        } catch (error) {
            console.error('Fetch Logs Error:', error);
            setApiError(error.message);
        } finally {
            setIsLoading(false);
        }
    }, [authToken, handleLogout]);

    const handleNavClick = (key) => {
        if (key === 'logs') {
            setActiveView('logs');
            fetchLogs();
        } else {
            setActiveView(key);
            handleCollectionSwitch(key);
        }
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


    // --- Filtering Logic (Client-Side) ---
    // Every structured filter (select/text-contains/boolean/range) combines with AND, and with
    // the free-text search — unlike the old model where only one of "pick a field" or "search
    // everything" could be active at a time.

    const filterOptionsByField = useMemo(() => {
        const options = {};
        (activeCollection.filters || []).forEach(f => {
            if (f.type !== 'select') return;
            const values = items.map(item => item[f.field]).filter(Boolean);
            options[f.key] = [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
        });
        return options;
    }, [items, activeCollection.filters]);

    const handleStructuredFilterChange = (key, value) => {
        setStructuredFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStructuredFilters({});
    };

    const filteredItems = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        const displayFields = activeCollection.fields.filter(field => !EXCLUDED_INTERNAL_COLUMNS.includes(field));

        return items.filter(item => {
            if (term && !displayFields.some(key => String(item[key] ?? '').toLowerCase().includes(term))) {
                return false;
            }

            return (activeCollection.filters || []).every(f => {
                const value = structuredFilters[f.key];

                if (f.type === 'select') {
                    if (!value) return true;
                    return String(item[f.field] ?? '').toLowerCase() === value.toLowerCase();
                }
                if (f.type === 'text-contains') {
                    if (!value) return true;
                    const needle = value.toLowerCase();
                    return f.fields.some(key => String(item[key] ?? '').toLowerCase().includes(needle));
                }
                if (f.type === 'boolean') {
                    if (!value || value === 'all') return true;
                    return Boolean(item[f.field]) === (value === 'yes');
                }
                if (f.type === 'range') {
                    const hasMin = value?.min !== '' && value?.min !== undefined;
                    const hasMax = value?.max !== '' && value?.max !== undefined;
                    if (!hasMin && !hasMax) return true;
                    const num = parseFloat(item[f.field]);
                    if (Number.isNaN(num)) return false;
                    if (hasMin && num < parseFloat(value.min)) return false;
                    if (hasMax && num > parseFloat(value.max)) return false;
                    return true;
                }
                return true;
            });
        });
    }, [items, searchTerm, structuredFilters, activeCollection.fields, activeCollection.filters]);

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

    const renderItemsTable = () => (
        <div className="bg-white p-6 rounded-xl shadow-xl mt-6 overflow-x-auto">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="2xl font-bold text-[#333333] flex items-center">
                    {activeCollection.name} Data
                    <span className="ml-2 text-sm font-medium text-[#0071B8] p-1 bg-[#EAF4FA] rounded-full">{items.length} items</span>
                </h2>

                {activeCollectionKey !== 'users' && (
                    <button
                        onClick={() => setIsFormVisible(true)}
                        className="px-4 py-2 text-sm font-semibold rounded-lg shadow-md transition-all duration-150 flex items-center bg-[#ED7300] hover:bg-[#C25F00] hover:-translate-y-0.5 hover:shadow-md text-white"
                        disabled={isLoading}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New {activeCollection.name.slice(0, -1)}
                    </button>
                )}
            </div>

            {apiError && (
                <div className="bg-[#FDECEC] border border-[#C62828] text-[#C62828] px-4 py-3 rounded-lg my-4" role="alert">
                    <p className="font-bold">Data Error:</p>
                    <p className="text-sm">{apiError}</p>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search all fields..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm w-full sm:w-56 transition-colors duration-150"
                        disabled={isLoading}
                    />
                    <Filter className="w-5 h-5 text-[#8A8A8A] absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>

                {(activeCollection.filters || []).map(f => {
                    if (f.type === 'select') {
                        return (
                            <div key={f.key} className="relative">
                                <select
                                    value={structuredFilters[f.key] || ''}
                                    onChange={(e) => handleStructuredFilterChange(f.key, e.target.value)}
                                    className="appearance-none pr-8 pl-3 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm transition-colors duration-150"
                                    disabled={isLoading}
                                >
                                    <option value="">{f.label}: All</option>
                                    {(filterOptionsByField[f.key] || []).map(value => (
                                        <option key={value} value={value}>{value}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-[#575757] absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                            </div>
                        );
                    }
                    if (f.type === 'text-contains') {
                        return (
                            <input
                                key={f.key}
                                type="text"
                                placeholder={f.label}
                                value={structuredFilters[f.key] || ''}
                                onChange={(e) => handleStructuredFilterChange(f.key, e.target.value)}
                                className="px-3 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm w-40 transition-colors duration-150"
                                disabled={isLoading}
                            />
                        );
                    }
                    if (f.type === 'boolean') {
                        return (
                            <div key={f.key} className="relative">
                                <select
                                    value={structuredFilters[f.key] || 'all'}
                                    onChange={(e) => handleStructuredFilterChange(f.key, e.target.value)}
                                    className="appearance-none pr-8 pl-3 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm transition-colors duration-150"
                                    disabled={isLoading}
                                >
                                    <option value="all">{f.label}: All</option>
                                    <option value="yes">{f.label}: Yes</option>
                                    <option value="no">{f.label}: No</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-[#575757] absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                            </div>
                        );
                    }
                    if (f.type === 'range') {
                        const range = structuredFilters[f.key] || {};
                        return (
                            <div key={f.key} className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-[#575757]">{f.label}</span>
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={range.min ?? ''}
                                    onChange={(e) => handleStructuredFilterChange(f.key, { ...range, min: e.target.value })}
                                    className="w-20 px-2 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm"
                                    disabled={isLoading}
                                />
                                <span className="text-[#8A8A8A]">-</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={range.max ?? ''}
                                    onChange={(e) => handleStructuredFilterChange(f.key, { ...range, max: e.target.value })}
                                    className="w-20 px-2 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm"
                                    disabled={isLoading}
                                />
                            </div>
                        );
                    }
                    return null;
                })}

                {(searchTerm.trim() !== '' || Object.values(structuredFilters).some(v => {
                    if (v === undefined || v === null || v === '' || v === 'all') return false;
                    if (typeof v === 'object') return (v.min ?? '') !== '' || (v.max ?? '') !== '';
                    return true;
                })) && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="px-3 py-2 text-sm text-[#575757] hover:text-[#333333] border border-[#C7C7C7] rounded-lg hover:bg-[#F4F6F8] transition flex items-center"
                        disabled={isLoading}
                    >
                        <X className="w-4 h-4 mr-1" /> Clear filters
                    </button>
                )}
            </div>

            {/* RESIZABLE TABLE DISPLAY */}
            <table className="min-w-full divide-y divide-[#C7C7C7]" style={{ tableLayout: 'fixed' }}>
                <ResizableTableHeader
                    columns={activeCollection.compactFields}
                    columnWidths={columnWidths}
                    setColumnWidths={setColumnWidths}
                />

                <tbody className="bg-white divide-y divide-[#C7C7C7]">
                    {isLoading && items.length === 0 ? (
                        <tr>
                            <td colSpan={activeCollection.compactFields.length + 1} className="px-4 py-4 text-center text-[#0071B8]">
                                <Loader className="w-5 h-5 animate-spin inline mr-2" /> Loading data from API...
                            </td>
                        </tr>
                    ) : filteredItems.length === 0 ? (
                        <tr>
                            <td colSpan={activeCollection.compactFields.length + 1} className="px-4 py-4 text-center text-[#8A8A8A]">
                                No items found matching filter criteria.
                            </td>
                        </tr>
                    ) : (
                        filteredItems.map(item => (
                            <tr
                                key={item.id}
                                onClick={() => !isLoading && openModalForEdit(item)}
                                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isLoading) { e.preventDefault(); openModalForEdit(item); } }}
                                role="button"
                                tabIndex={0}
                                title="Click to view details"
                                aria-label="View details"
                                className="hover:bg-[#EAF4FA] transition-colors duration-150 cursor-pointer"
                            >
                                {activeCollection.compactFields.map(field => {
                                    const type = getFieldType(field);

                                    return (
                                        <td
                                            key={field}
                                            // Apply dynamic width style to the cell
                                            style={{ width: columnWidths[field] || 'auto' }}
                                            className="px-4 py-3 whitespace-nowrap text-sm text-[#575757] truncate overflow-hidden"
                                        >
                                            {field === 'id' ? String(item[field]).substring(0, 8) + '...'
                                                : type === 'checkbox' ? (item[field] ? 'Yes' : 'No')
                                                : type === 'textarea' ? (stripHtml(item[field]) || 'N/A')
                                                : String(item[field] || 'N/A')}
                                        </td>
                                    )})}
                                <td style={{ width: 80 }} className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                                    <ChevronRight className="w-5 h-5 text-[#8A8A8A] inline-block" aria-hidden="true" />
                                    {isAdmin && activeCollectionKey !== 'users' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                            className="text-[#C62828] hover:text-[#a02020] transition p-1 rounded-full hover:bg-[#FDECEC] disabled:opacity-50 ml-2"
                                            disabled={isLoading}
                                            title="Delete Record"
                                            aria-label="Delete Record"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
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
            <div className="bg-white p-6 rounded-xl shadow-xl overflow-x-auto">
                <div className="flex justify-between items-center mb-4 flex-wrap">
                    <h2 className="text-2xl font-bold text-[#333333] flex items-center">
                        <Clock className="w-6 h-6 mr-2 text-[#0071B8]" />
                        Audit Logs
                    </h2>
                    <div className="relative mt-2 sm:mt-0">
                        <input
                            type="text"
                            placeholder="Filter Logs (Action, User, or Table)"
                            value={logFilterTerm}
                            onChange={(e) => setLogFilterTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm w-full sm:w-64 transition-colors duration-150"
                            disabled={isLoading}
                        />
                        <Filter className="w-5 h-5 text-[#8A8A8A] absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                </div>
                <p className="text-sm text-[#8A8A8A] mb-4">Every user action is recorded here.</p>

                <div className="max-h-96 overflow-y-auto border border-[#C7C7C7] rounded-lg">
                    {/* CRITICAL: Added style={{ tableLayout: 'fixed' }} for resizing to work */}
                    <table className="min-w-full divide-y divide-[#C7C7C7]" style={{ tableLayout: 'fixed' }}>
                        
                        {/* Use ResizableTableHeader for Audit Logs */}
                        <ResizableTableHeader
                            columns={logColumns}
                            columnWidths={columnWidths}
                            setColumnWidths={setColumnWidths}
                            actionColumnTitle={null} // Audit logs don't have an action column
                        />
                        
                        <tbody className="bg-white divide-y divide-[#C7C7C7]">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-4 text-center text-[#8A8A8A]">
                                        No matching logs found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, index) => (
                                    <tr key={index} className="hover:bg-[#EAF4FA] transition-colors duration-150">
                                        <td
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Action'] }}
                                            className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${log.action === 'CREATE' ? 'text-[#2E7D32]' : log.action === 'UPDATE' ? 'text-[#0071B8]' : 'text-[#C62828]'}`}
                                        >
                                            {log.action}
                                        </td>
                                        <td
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['User'] }}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-[#575757] font-medium"
                                        >
                                            {log.user_name || log.user_id}
                                        </td>
                                        <td
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Table'] }}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-[#8A8A8A]"
                                        >
                                            {log.table_name}
                                        </td>
                                        <td
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Record ID'] }}
                                            className="px-4 py-2 whitespace-nowrap text-xs font-mono text-[#8A8A8A]"
                                        >
                                            {String(log.document_id).substring(0, 8)}
                                        </td>
                                        <td
                                            // Apply dynamic width to cells
                                            style={{ width: columnWidths['Timestamp'] }}
                                            className="px-4 py-2 whitespace-nowrap text-sm text-[#8A8A8A]"
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

    
    if (!authToken || !userData) {
        return <LoginScreen
            setAuthToken={setAuthToken}
            setUserData={setUserData}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
        />;
    }

    const isLogsView = activeView === 'logs' && isAdmin;

    return (
        <div className="min-h-screen bg-[#F4F6F8] font-sans">
            <Sidebar
                visibleCollectionKeys={visibleCollectionKeys}
                initialCollections={initialCollections}
                activeView={activeView}
                onNavClick={handleNavClick}
                isAdmin={isAdmin}
                userData={userData}
                onLogout={handleLogout}
                isLoading={isLoading}
            />

            <main className="md:ml-64 min-w-0 p-4 sm:p-8">
                <div className="max-w-7xl mx-auto w-full">
                    {isLogsView ? renderAuditLogs() : renderItemsTable()}
                </div>
            </main>

            {/* Modals must be rendered outside the main content flow */}
            <CreateItemModal
                isOpen={isFormVisible}
                onClose={cancelForm}
                activeCollection={activeCollection}
                newItemData={newItemData}
                onFieldChange={handleNewItemChange}
                onSubmit={handleCreate}
                isLoading={isLoading}
                allProductLines={allProductLines}
                authToken={authToken}
            />

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
                    authToken={authToken}
                />
            )}
        </div>
    );
};

export default App;
