import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, Home, Newspaper, Stethoscope, GraduationCap, Microscope, ChevronDown, ArrowRight, User } from 'lucide-react';
import UserMenu from '../auth/UserMenu';
import AuthModal from '../auth/AuthModal';
import CreditRedeemModal from '../credits/CreditRedeemModal';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import SearchDropdown from '../common/SearchDropdown';
import { useDebounce } from '../../hooks/useDebounce';
import { searchApi, articlesApi, researchApi, coursesApi } from '../../lib/api';
import type { GlobalSearchResult } from '../../types';

const ENABLE_COURSES = import.meta.env.VITE_ENABLE_COURSES !== 'false';

// Types for navigation data
interface NavItemData {
  label: string;
  icon: React.ElementType;
  items: { name: string; path: string; description?: string }[];
}

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Header expansion state
  const [activePath, setActivePath] = useState<string | null>(null);
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search State
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const { user } = useAuth();

  // H4: Replace raw useEffect fetch with TanStack Query hooks.
  // Data is near-static (tags, journals, categories change infrequently),
  // so a 5-minute staleTime prevents redundant requests on every route change.
  const { data: tags = [] } = useQuery<string[]>({
    queryKey: ['navbar-tags'],
    queryFn: () => articlesApi.getTags() as Promise<string[]>,
    staleTime: 5 * 60 * 1000,
  });

  const { data: journals = [] } = useQuery<string[]>({
    queryKey: ['navbar-journals'],
    queryFn: () => researchApi.getJournals() as Promise<string[]>,
    staleTime: 5 * 60 * 1000,
  });

  const { data: courseCats = [] } = useQuery<string[]>({
    queryKey: ['navbar-course-categories'],
    queryFn: () => coursesApi.getCategories() as Promise<string[]>,
    staleTime: 5 * 60 * 1000,
    enabled: ENABLE_COURSES,
  });

  // Derive navData from query results — recomputed only when the data changes.
  const navData = useMemo<Record<string, NavItemData>>(() => {
    const data: Record<string, NavItemData> = {
      '/articles': {
        label: 'المقالات',
        icon: Newspaper,
        items: tags.slice(0, 6).map(tag => ({
          name: tag,
          path: `/articles?tag=${encodeURIComponent(tag)}`,
          description: `تصفح المقالات المتعلقة بـ ${tag}`,
        })),
      },
      '/clinical-cases': {
        label: 'حالات سريرية',
        icon: Stethoscope,
        items: tags.slice(0, 4).map(tag => ({
          name: tag,
          path: `/clinical-cases?tag=${encodeURIComponent(tag)}`,
          description: `دراسة حالات سريرية في ${tag}`,
        })),
      },
      '/research-topics': {
        label: 'أبحاث علمية',
        icon: Microscope,
        items: journals.slice(0, 4).map(journal => ({
          name: journal,
          path: `/research-topics?journal=${encodeURIComponent(journal)}`,
          description: `أحدث الأبحاث من مجلة ${journal}`,
        })),
      },
    };

    if (ENABLE_COURSES) {
      data['/courses'] = {
        label: 'الدورات',
        icon: GraduationCap,
        items: courseCats.slice(0, 4).map(cat => ({
          name: cat,
          path: `/courses?category=${encodeURIComponent(cat)}`,
          description: `دورات تدريبية مختصة في ${cat}`,
        })),
      };
    }

    return data;
  }, [tags, journals, courseCats]);

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/articles?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowSearchResults(false);
      setIsMenuOpen(false);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const closeSearchResults = () => {
    setShowSearchResults(false);
    setIsMenuOpen(false);
    setShowMobileSearch(false);
  };

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      setSearchResults([]);
      setIsSearching(true);
      setShowSearchResults(true);
      return;
    }
    setIsSearching(false);
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const debouncedSearchTerm = useDebounce(searchQuery, 300);

  useEffect(() => {
    let isCancelled = false;
    const performSearch = async () => {
      const trimmedSearchTerm = debouncedSearchTerm.trim();
      if (trimmedSearchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchApi.searchAll(trimmedSearchTerm);
          if (!isCancelled) {
            setSearchResults(results);
            setShowSearchResults(true);
          }
        } catch (error) {
          console.error("Search error:", error);
          if (!isCancelled) setSearchResults([]);
        } finally {
          if (!isCancelled) setIsSearching(false);
        }
      } else {
        setIsSearching(false);
        setSearchResults([]);
        setShowSearchResults(false);
      }
    };
    performSearch();
    return () => { isCancelled = true; };
  }, [debouncedSearchTerm]);

  const handleMouseEnter = (path: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (navData[path]) {
      setActivePath(path);
      setIsMenuExpanded(true);
    } else {
      setIsMenuExpanded(false);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsMenuExpanded(false);
    }, 200); // Reduced delay for snappier response
  };

  return (
    <>
      <header className="sticky top-4 z-50 px-4 md:px-6 pointer-events-none">
        <div
          className="container-modern max-w-6xl mx-auto pointer-events-auto"
          onMouseLeave={handleMouseLeave}
        >
          <div className={`glass-pill rounded-[2rem] px-6 transition-all duration-500 ease-in-out overflow-hidden ${isMenuExpanded ? 'shadow-2xl ring-1 ring-blue-100/50 z-50 bg-white/95 backdrop-blur-xl' : 'z-40'}`}>
            <div className="relative flex justify-between items-center h-16 md:h-18 lg:h-20 overflow-visible">

              {/* Logo container */}
              <Link to="/" className="flex items-center gap-1.5 group shrink-0" onMouseEnter={() => handleMouseEnter('/')}>
                <img
                  src="/logo.png"
                  alt="Tabeeb Logo"
                  className="h-16 md:h-20 w-auto drop-shadow-md transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex flex-col items-start justify-center -space-y-0.5 pt-1">
                  <span className="text-[26px] font-bold text-gray-900 leading-none" style={{ fontFamily: "'MontserratArabic', sans-serif" }}>
                    طبيب
                  </span>
                  <span className="text-[26px] font-bold text-gray-900 leading-none tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    Tabeeb
                  </span>
                </div>
              </Link>

              {/* Mobile buttons */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 md:hidden z-30 flex items-center gap-2 pl-4">
                <button
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {isMenuOpen ? <X size={24} className="text-gray-700" /> : <Menu size={24} className="text-gray-700" />}
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setShowMobileSearch(!showMobileSearch)}
                >
                  <Search size={22} className="text-gray-700" />
                </button>
              </div>

              {/* Center Navigation & Search (Flip Animation) */}
              <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] max-w-[50vw] justify-center items-center pointer-events-none perspective-1000">

                {/* Nav Links */}
                <nav className={`flex items-center space-x-2 space-x-reverse transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] absolute pointer-events-auto ${isSearchExpanded ? 'opacity-0 translate-y-4 scale-95 pointer-events-none blur-sm' : 'opacity-100 translate-y-0 scale-100 blur-none'}`}>
                  {[
                    { path: '/', label: 'الرئيسية', icon: Home },
                    { path: '/articles', label: 'المقالات', icon: Newspaper },
                    { path: '/clinical-cases', label: 'حالات سريرية', icon: Stethoscope },
                    ...(ENABLE_COURSES ? [{ path: '/courses', label: 'الدورات', icon: GraduationCap }] : []),
                    { path: '/research-topics', label: 'أبحاث علمية', icon: Microscope },
                  ].map(({ path, label, icon: Icon }) => (
                    <Link
                      key={path}
                      to={path}
                      onMouseEnter={() => handleMouseEnter(path)}
                      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full font-medium whitespace-nowrap text-sm transition-all duration-300 group ${isActive(path)
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                        } ${isMenuExpanded && activePath === path ? 'bg-blue-50 text-blue-600 font-bold' : ''}`}
                    >
                      <Icon size={16} className={isActive(path) ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'} />
                      <span>{label}</span>
                      {navData[path] && (
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-300 ${isMenuExpanded && activePath === path ? 'rotate-180 text-blue-600' : 'text-gray-400'}`}
                        />
                      )}
                    </Link>
                  ))}
                </nav>

                {/* Centered Search Field */}
                <div
                  className={`w-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] absolute pointer-events-auto ${isSearchExpanded ? 'opacity-100 -translate-y-0 scale-100 blur-none' : 'opacity-0 -translate-y-4 scale-95 pointer-events-none blur-sm'}`}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setTimeout(() => {
                        if (!searchQuery) setIsSearchExpanded(false);
                        setShowSearchResults(false);
                      }, 200);
                    }
                  }}
                >
                  <form onSubmit={handleSearch} className="relative w-full shadow-lg rounded-2xl">
                    <input
                      id="navbar-search-input"
                      type="text"
                      placeholder="ابحث في المقالات، الأبحاث، والدورات..."
                      className="w-full py-2.5 pr-12 pl-12 text-gray-800 bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none text-base transition-all"
                      value={searchQuery}
                      onChange={(e) => handleSearchQueryChange(e.target.value)}
                      onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
                    />
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchExpanded(false);
                        setShowSearchResults(false);
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <X size={18} />
                    </button>
                  </form>
                  <SearchDropdown
                    isOpen={showSearchResults}
                    onClose={closeSearchResults}
                    results={searchResults}
                    loading={isSearching}
                    searchTerm={searchQuery.trim()}
                  />
                </div>
              </div>

              {/* Desktop Right Side (Actually Left Side due to RTL) */}
              <div className="hidden md:flex items-center gap-4 absolute left-0 top-1/2 -translate-y-1/2 pl-4">
                <button
                  onClick={() => {
                    setIsSearchExpanded(!isSearchExpanded);
                    if (!isSearchExpanded) setTimeout(() => document.getElementById('navbar-search-input')?.focus(), 100);
                  }}
                  className={`p-2.5 rounded-full transition-all duration-300 ${isSearchExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
                >
                  <Search size={22} className={`transition-transform duration-300 ${isSearchExpanded ? 'scale-90' : 'scale-100'}`} />
                </button>

                <div className="opacity-100">
                  {user ? (
                    <UserMenu onRedeemClick={() => setShowRedeemModal(true)} />
                  ) : (
                    <button
                      onClick={() => openAuthModal('register')}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"
                    >
                      <span>انضم إلينا</span>
                      <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                        <User size={14} className="text-white" />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Content Panel using Grid Row Height Transition (Ultra smooth) */}
            <div
              className={`grid transition-all duration-500 ease-in-out border-t border-transparent ${isMenuExpanded ? 'grid-rows-[1fr] border-gray-100 opacity-100 py-8' : 'grid-rows-[0fr] opacity-0 py-0'}`}
            >
              <div className="overflow-hidden">
                {activePath && navData[activePath] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn px-2">
                    {navData[activePath].items.map((cat, idx) => (
                      <Link
                        key={idx}
                        to={cat.path}
                        className="group/item p-5 rounded-2xl hover:bg-blue-50/50 transition-all duration-300 flex flex-col gap-2 border border-transparent hover:border-blue-100 hover:shadow-sm"
                        onClick={() => setIsMenuExpanded(false)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-900 group-hover/item:text-blue-600 transition-colors">
                            {cat.name}
                          </span>
                          <ArrowRight size={16} className="text-blue-400 opacity-0 -translate-x-4 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                        </div>
                        {cat.description && (
                          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                            {cat.description}
                          </p>
                        )}
                      </Link>
                    ))}

                    <div className="col-span-full mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        {React.createElement(navData[activePath].icon, { size: 16 })}
                        <span>تصفح كل {navData[activePath].label}</span>
                      </div>
                      <Link
                        to={activePath}
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
                        onClick={() => setIsMenuExpanded(false)}
                      >
                        عرض الكل <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100/50 animate-fadeIn z-40">
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث في المقالات..."
                    className="search-input text-gray-700 placeholder-gray-400"
                    value={searchQuery}
                    onChange={(e) => handleSearchQueryChange(e.target.value)}
                    onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
                  />
                  <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                  </button>
                  <SearchDropdown
                    isOpen={showSearchResults}
                    onClose={closeSearchResults}
                    results={searchResults}
                    loading={isSearching}
                    searchTerm={searchQuery.trim()}
                  />
                </div>
              </form>
              <nav className="flex flex-col space-y-2">
                {[
                  { path: '/', label: 'الرئيسية', icon: Home },
                  { path: '/articles', label: 'المقالات', icon: Newspaper },
                  { path: '/clinical-cases', label: 'حالات سريرية', icon: Stethoscope },
                  ...(ENABLE_COURSES ? [{ path: '/courses', label: 'الدورات', icon: GraduationCap }] : []),
                  { path: '/research-topics', label: 'أبحاث علمية', icon: Microscope },
                ].map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-medium text-base transition-all duration-300 ${isActive(path)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <UserMenu onRedeemClick={() => {
                  setIsMenuOpen(false);
                  setShowRedeemModal(true);
                }} />
              </div>
            </div>
          )}
        </div>
        {showMobileSearch && (
          <div className="md:hidden absolute top-full left-4 right-4 mt-2 bg-white/90 backdrop-blur-md border border-white rounded-2xl shadow-lg overflow-hidden animate-slideDown z-40 pointer-events-auto">
            <form onSubmit={handleSearch} className="relative p-4">
              <input
                type="text"
                placeholder="ابحث في المقالات..."
                className="w-full text-gray-700 placeholder-gray-400 bg-white/80 backdrop-blur-md rounded-lg border border-black/20 focus:border-black/40 focus:ring-2 focus:ring-blue-400/30 focus:outline-none transition-all duration-300"
                value={searchQuery}
                onChange={(e) => handleSearchQueryChange(e.target.value)}
                onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
              />
              <button
                type="submit"
                className="absolute right-7 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Search size={18} />
              </button>
              <SearchDropdown
                isOpen={showSearchResults}
                onClose={closeSearchResults}
                results={searchResults}
                loading={isSearching}
                searchTerm={searchQuery.trim()}
              />
            </form>
          </div>
        )}
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
      <CreditRedeemModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
      />
    </>
  );
};

export default Navbar;
