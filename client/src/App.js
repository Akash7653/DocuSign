// 📁 /client/src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/Dashboard';
import SignDocumentPage from './pages/SignDocumentPage'; // Import the new signing page
import PublicSign from './pages/PublicSign';

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    if (storedUser && token) setUser(storedUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-white">
        <Router>
          {/* ✅ Navbar visible only when user is logged in */}
          {user && (
            <Navbar
              isAuthenticated={!!user}
              onLogout={handleLogout}
              toggleTheme={toggleTheme}
              theme={theme}
            />
          )}

          {/* ✅ Routes */}
          <Routes>
            <Route path="/" element={user ? <HomePage user={user} /> : <Navigate to="/register" />} />
            <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/login" />} />
            <Route path="/login" element={!user ? <LoginPage setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" />} />

            {/* NEW route for the document signing page */}
            {/* It requires a document ID as a URL parameter (:docId) */}
            {/* The page is protected, redirecting to login if the user is not authenticated */}
            <Route path="/sign-document/:docId" element={user ? <SignDocumentPage /> : <Navigate to="/login" />} />
            <Route path="/public-sign/:token" element={<PublicSign />} />
          </Routes>
        </Router>
      </div>
    </div>
  );
}

export default App;
