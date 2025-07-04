import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, Upload, Menu, X } from 'lucide-react';

const Navbar = ({ isAuthenticated, onLogout, toggleTheme, theme }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavToggle = () => setMenuOpen(!menuOpen);

  return (
    <nav className="bg-purple-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo + Title */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <img src="/logo.png" alt="DocuSign Logo" className="w-8 h-8" />
          <h1 className="text-xl font-bold">DocuSign</h1>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          {isAuthenticated && (
            <>
              <Link to="/dashboard" className="hover:text-yellow-300 flex items-center gap-1">
                <Upload size={18} /> Dashboard
              </Link>
              <button onClick={onLogout} className="hover:text-yellow-300 flex items-center gap-1">
                <LogOut size={18} /> Logout
              </button>
            </>
          )}
          <button onClick={toggleTheme} className="hover:text-yellow-300">
            {theme === 'dark' ? <Sun /> : <Moon />}
          </button>
        </div>

        {/* Mobile Toggle Button */}
        <button className="md:hidden" onClick={handleNavToggle}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {menuOpen && (
        <div className="md:hidden px-4 pb-4 space-y-3 text-sm">
          {isAuthenticated && (
            <>
              <Link to="/dashboard" onClick={handleNavToggle} className="block hover:text-yellow-300">
                <Upload size={16} className="inline mr-1" /> Dashboard
              </Link>
              <button onClick={() => { onLogout(); handleNavToggle(); }} className="block hover:text-yellow-300">
                <LogOut size={16} className="inline mr-1" /> Logout
              </button>
            </>
          )}
          <button onClick={() => { toggleTheme(); handleNavToggle(); }} className="hover:text-yellow-300 block">
            {theme === 'dark' ? <Sun size={16} className="inline mr-1" /> : <Moon size={16} className="inline mr-1" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
