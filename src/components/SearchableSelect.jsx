import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader } from 'lucide-react';
import { BASE_API_URL } from '../config/collections';

// Free-text input backed by a live search against a KPI database lookup (people, customers,
// factory sites, ...). Suggestions narrow as you type, but any typed value is still accepted —
// the underlying column is free text, not a foreign key, so an entry missing from KPI data
// (e.g. a brand-new hire) must remain enterable.
const SearchableSelect = ({ id, endpoint, authToken, value, onChange, disabled, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchOptions = (query) => {
        if (!authToken) return;
        setIsLoading(true);
        fetch(`${BASE_API_URL}${endpoint}?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        })
            .then(res => res.ok ? res.json() : [])
            .then(data => setOptions(Array.isArray(data) ? data : []))
            .catch(() => setOptions([]))
            .finally(() => setIsLoading(false));
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);
        setIsOpen(true);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchOptions(newValue), 250);
    };

    const handleFocus = () => {
        setIsOpen(true);
        if (options.length === 0) fetchOptions(value || '');
    };

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                id={id}
                type="text"
                autoComplete="off"
                value={value ?? ''}
                onChange={handleInputChange}
                onFocus={handleFocus}
                disabled={disabled}
                placeholder={placeholder}
                className="p-3 pl-9 border border-[#C7C7C7] rounded-lg focus:ring-2 focus:ring-[#0071B8] focus:border-[#0071B8] shadow-sm w-full transition-colors duration-150"
            />
            <Search className="w-4 h-4 text-[#8A8A8A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

            {isOpen && !disabled && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-[#C7C7C7] rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {isLoading ? (
                        <div className="px-3 py-2 text-sm text-[#8A8A8A] flex items-center">
                            <Loader className="w-4 h-4 animate-spin mr-2" /> Searching...
                        </div>
                    ) : options.length > 0 ? (
                        options.map(option => (
                            <button
                                type="button"
                                key={option}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(option)}
                                className="w-full text-left px-3 py-2 text-sm text-[#333333] hover:bg-[#EAF4FA] transition-colors"
                            >
                                {option}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-sm text-[#8A8A8A]">No matches — you can keep typing a custom value.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
