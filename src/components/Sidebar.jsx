import React, { useState, useRef, useEffect } from 'react';
import { Layers, Package, Users as UsersIcon, ClipboardList, LogOut, Shield, Menu, X, ChevronUp } from 'lucide-react';
import logoAvocarbon from '../assets/logo-avocarbon.png';
import { APP_VERSION } from '../config/constants';

const NAV_ICONS = {
    product_lines: Layers,
    products: Package,
    users: UsersIcon,
};

const Sidebar = ({ visibleCollectionKeys, initialCollections, activeView, onNavClick, isAdmin, userData, onLogout, isLoading }) => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNav = (key) => {
        onNavClick(key);
        setMobileOpen(false);
    };

    const initials = (userData.displayName || '?')
        .trim()
        .split(/\s+/)
        .map(p => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const navButtonClass = (active) =>
        `w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
            active ? 'bg-white/15 text-white border-l-4 border-[#ED7300] pl-2' : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`;

    return (
        <>
            {/* Mobile toggle */}
            <button
                onClick={() => setMobileOpen(prev => !prev)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#0A4B78] text-white rounded-lg shadow-lg"
                aria-label="Toggle navigation"
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-30"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={`fixed top-0 left-0 h-screen w-64 bg-[#0A4B78] text-white flex flex-col z-40 flex-shrink-0 transform transition-transform duration-200 ease-in-out ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                } md:translate-x-0`}
            >
                {/* Brand */}
                <div className="flex items-center justify-center p-4 border-b border-white/10">
                    <img src={logoAvocarbon} alt="AVOCARBON Logo" className="h-10 w-auto object-contain" title="AVOCARBON" />
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
                    {visibleCollectionKeys.map(key => {
                        const Icon = NAV_ICONS[key] || Package;
                        return (
                            <button
                                key={key}
                                onClick={() => handleNav(key)}
                                disabled={isLoading}
                                className={navButtonClass(activeView === key)}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span>{initialCollections[key].name}</span>
                            </button>
                        );
                    })}

                    {isAdmin && (
                        <button
                            onClick={() => handleNav('logs')}
                            disabled={isLoading}
                            className={navButtonClass(activeView === 'logs')}
                        >
                            <ClipboardList className="w-5 h-5 flex-shrink-0" />
                            <span>Audit Logs</span>
                        </button>
                    )}
                </nav>

                {/* Profile */}
                <div ref={profileRef} className="relative p-2 border-t border-white/10">
                    {profileOpen && (
                        <div className="absolute bottom-full left-2 right-2 mb-2 bg-white text-[#333333] rounded-lg shadow-xl overflow-hidden">
                            <div className="p-4 border-b border-[#C7C7C7]">
                                <p className="font-semibold text-sm truncate flex items-center">
                                    {userData.displayName}
                                    {isAdmin && <Shield className="w-4 h-4 ml-2 text-[#ED7300] flex-shrink-0" title="Administrator Access" />}
                                </p>
                                <p className="text-xs text-[#8A8A8A] mt-1 capitalize">{userData.user_role}</p>
                            </div>
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center space-x-2 px-4 py-3 text-sm font-semibold text-[#C62828] hover:bg-[#FDECEC] transition"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setProfileOpen(prev => !prev)}
                        className="w-full flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-white/10 transition"
                    >
                        <span className="w-8 h-8 rounded-full bg-[#ED7300] flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {initials}
                        </span>
                        <span className="flex-1 text-left text-sm font-medium truncate">{userData.displayName}</span>
                        <ChevronUp className={`w-4 h-4 flex-shrink-0 transition-transform ${profileOpen ? '' : 'rotate-180'}`} />
                    </button>
                    <p className="text-[10px] text-white/40 text-center mt-2">v{APP_VERSION}</p>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
