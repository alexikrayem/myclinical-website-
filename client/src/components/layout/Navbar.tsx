import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import UserMenu from '../auth/UserMenu';
import CreditRedeemModal from '../credits/CreditRedeemModal';


const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/articles?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setIsMenuOpen(false);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-gradient-to-b from-white to-white/70 backdrop-blur-lg border-b border-white/20 shadow-sm">
        <div className="container-modern">
          {/* Main Navbar content wrapper */}
          <div className="relative flex justify-between items-center h-16 md:h-20 overflow-visible transition-all duration-300 ease-in-out">

            {/* Logo container - NOW ON THE RIGHT */}
            <Link to="/" className="flex items-center gap-1.5 group">
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

            {/* Mobile buttons (menu + search) */}
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


            {/* Desktop Navigation - CENTERED */}
            <nav className="hidden md:flex items-center space-x-6 space-x-reverse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {[
                { path: '/', label: 'الرئيسية' },
                { path: '/articles', label: 'المقالات' },
                { path: '/clinical-cases', label: 'حالات سريرية' },
                { path: '/courses', label: 'الدورات' },
                { path: '/research-topics', label: 'أبحاث علمية' },
              ].map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`relative px-4 py-2 rounded-full font-medium transition-all duration-300 ${isActive(path)
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                >
                  {label}
                </Link>
              ))}
            </nav>


            {/* Desktop Right Side - Search + User Menu */}
            <div className="hidden md:flex items-center gap-4 absolute left-0 top-1/2 -translate-y-1/2 pl-4">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="ابحث في المقالات..."
                  className="search-input w-48 lg:w-64 text-gray-700 placeholder-gray-400 bg-white/80 backdrop-blur-md rounded-lg shadow-lg hover:shadow-xl focus:shadow-xl focus:ring-2 focus:ring-blue-400/40 focus:outline-none transition-all duration-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Search size={18} />
                </button>
              </form>

              {/* User Menu */}
              <UserMenu onRedeemClick={() => setShowRedeemModal(true)} />
            </div>
          </div>

          {/* Mobile Navigation (opened menu overlay) */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100 animate-fadeIn bg-white/90 backdrop-blur-md z-40">
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث في المقالات..."
                    className="search-input text-gray-700 placeholder-gray-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                  </button>
                </div>
              </form>
              <nav className="flex flex-col space-y-2">
                {[
                  { path: '/', label: 'الرئيسية' },
                  { path: '/articles', label: 'المقالات' },
                  { path: '/clinical-cases', label: 'حالات سريرية' },
                  { path: '/courses', label: 'الدورات' },
                  { path: '/research-topics', label: 'أبحاث علمية' },
                ].map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={toggleMenu}
                    className={`block px-3 py-2 rounded-md font-medium text-base text-center transition-all duration-300 ${isActive(path)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              {/* Mobile User Menu */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <UserMenu onRedeemClick={() => {
                  setIsMenuOpen(false);
                  setShowRedeemModal(true);
                }} />
              </div>
            </div>
          )}
        </div>
        {/* Mobile Search Overlay (slides down) */}
        {showMobileSearch && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-lg overflow-hidden animate-slideDown z-40">
            <form onSubmit={handleSearch} className="relative p-4">
              <input
                type="text"
                placeholder="ابحث في المقالات..."
                className="w-full text-gray-700 placeholder-gray-400 bg-white/80 backdrop-blur-md rounded-lg border border-black/20 focus:border-black/40 focus:ring-2 focus:ring-blue-400/30 focus:outline-none transition-all duration-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="absolute right-7 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Search size={18} />
              </button>
            </form>
          </div>
        )}

      </header>

      {/* Credit Redeem Modal */}
      <CreditRedeemModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
      />
    </>
  );
};

export default Navbar;