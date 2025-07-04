// 📁 /client/src/pages/HomePage.js
import React from 'react';

const HomePage = ({ user }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] text-center px-4">
      <h1 className="text-4xl font-bold text-purple-700 mb-4 animate-bounce">🎉 Welcome to DocuSign, {user?.name || 'Guest'}!</h1>
      <p className="text-lg text-gray-700 dark:text-gray-300">Upload, sign and share documents securely.</p>
    </div>
  );
};

export default HomePage;
