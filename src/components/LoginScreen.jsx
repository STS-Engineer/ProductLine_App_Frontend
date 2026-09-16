import { useState, useEffect } from 'react';
import { Package, User, Mail, Lock, Loader } from 'lucide-react';
import { BASE_API_URL } from '../config/collections';
import logoAvocarbon from '../assets/logo-avocarbon.png';

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
        <div className="min-h-screen flex flex-col md:flex-row bg-[#F4F6F8]">
            {/* Brand panel */}
            <div
                className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 overflow-hidden"
                style={{ background: 'linear-gradient(160deg, #0071B8 0%, #0A4B78 100%)' }}
            >
                <div className="absolute -right-16 -bottom-16 opacity-10">
                    <Package className="w-80 h-80 text-white" strokeWidth={1} />
                </div>

                <div className="bg-white rounded-lg px-4 py-3 self-start shadow-lg">
                    <img src={logoAvocarbon} alt="AVOCarbon Group" className="h-8 w-auto object-contain" />
                </div>

                <div className="relative">
                    <h2 className="text-3xl font-extrabold text-white mb-4 leading-tight whitespace-nowrap">
                        Products &amp; Product Lines
                    </h2>
                    <p className="text-white/80 max-w-sm">
                        The central catalog for AVOCarbon's product lines: specs, documentation and history, all in one place.
                    </p>
                </div>

                <p className="relative text-xs text-white/60">
                    &copy; {new Date().getFullYear()} AVOCarbon Group
                </p>
            </div>

            {/* Form panel */}
            <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">
                    <div className="md:hidden flex justify-center mb-2">
                        <img src={logoAvocarbon} alt="AVOCarbon Group" className="h-9 w-auto object-contain" />
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-3">
                        <div className="hidden md:flex w-11 h-11 rounded-xl items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EAF4FA' }}>
                            <Package className="w-6 h-6" style={{ color: '#0071B8' }} />
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-2xl font-bold" style={{ color: '#0A4B78' }}>
                                {isSigningUp ? 'Create Account' : 'Welcome back'}
                            </h1>
                            <p className="text-sm" style={{ color: '#8A8A8A' }}>
                                {isSigningUp ? 'Sign up to manage products & product lines' : 'Sign in to continue'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="border px-4 py-3 rounded-lg relative" style={{ backgroundColor: '#FDECEC', borderColor: '#C62828', color: '#C62828' }} role="alert">
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    <form onSubmit={isSigningUp ? handleSignup : handleLogin} className="space-y-4">
                        {isSigningUp && (
                            <div className="relative">
                                <User className="w-5 h-5 absolute left-3 top-1/3 transform -translate-y-1/2" style={{ color: '#8A8A8A' }} />
                                <input
                                    type="text"
                                    placeholder="Display Name (Auto-Generated)"
                                    value={finalDisplayName}
                                    onChange={(e) => setDisplayNameInput(e.target.value)}
                                    required={isSigningUp}
                                    disabled={isLoading}
                                    // MODIFICATION: Always apply grey style when signing up
                                    className="w-full p-3 pl-10 border rounded-lg outline-none transition"
                                    style={{ borderColor: '#C7C7C7', backgroundColor: '#F4F6F8', color: '#575757' }}
                                    readOnly={true}
                                />
                                <p className="text-xs mt-1 pl-10" style={{ color: '#8A8A8A' }}>
                                    {derivedDisplayName
                                        ? `Derived name: ${derivedDisplayName}. Start typing to override.`
                                        : 'Enter your work email first to auto-generate.'}
                                </p>
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#8A8A8A' }} />
                                <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setDisplayNameInput('');
                                }}
                                required
                                className="w-full p-3 pl-10 border rounded-lg outline-none transition focus:ring-2 border-[#C7C7C7] text-[#575757] focus:border-[#0071B8] focus:ring-[#0071B8]"
                                disabled={isLoading}
                            />
                        </div>
                        <div className="relative">
                            <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#8A8A8A' }} />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full p-3 pl-10 border rounded-lg outline-none transition focus:ring-2 border-[#C7C7C7] text-[#575757] focus:border-[#0071B8] focus:ring-[#0071B8]"
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 text-white font-semibold rounded-lg transition-all duration-150 flex items-center justify-center disabled:opacity-50 disabled:hover:translate-y-0 shadow-md bg-[#ED7300] hover:bg-[#C25F00] hover:-translate-y-0.5 hover:shadow-lg"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader className="w-5 h-5 animate-spin mr-2" />
                            ) : isSigningUp ? 'Sign Up' : 'Log In'}
                        </button>
                    </form>

                    <p className="text-center text-sm" style={{ color: '#575757' }}>
                        {isSigningUp ? (
                            <>
                                Already have an account?{' '}
                                <button onClick={() => {setIsSigningUp(false); setDisplayNameInput('');}} className="font-medium hover:underline" style={{ color: '#0071B8' }}>
                                    Log In
                                </button>
                            </>
                        ) : (
                            <>
                                Need an account?{' '}
                                <button onClick={() => {setIsSigningUp(true); setDisplayNameInput('');}} className="font-medium hover:underline" style={{ color: '#0071B8' }}>
                                    Sign Up
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
