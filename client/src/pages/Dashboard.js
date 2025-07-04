import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  FaLink,
  FaUpload,
  FaFilePdf,
  FaSignature,
  FaTrash,
  FaCheckCircle,
  FaDownload
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [docs, setDocs] = useState([]);
  const [file, setFile] = useState(null);
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      alert('You must be logged in to view the dashboard.');
      navigate('/login');
      return;
    }

    const fetchDocs = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/docs/', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // 💡 Ensure finalizedUrl is fully qualified (done in backend ideally)
        const formattedDocs = res.data.map(doc => ({
          ...doc,
          finalizedUrl: doc.finalizedUrl?.startsWith('http')
            ? doc.finalizedUrl
            : `http://localhost:5000${doc.finalizedUrl}`
        }));

        setDocs(formattedDocs);
        console.log('Fetched documents for dashboard:', formattedDocs);
      } catch (err) {
        console.error('Error fetching documents for dashboard:', err);
        if (err.response?.status === 401) {
          alert('Session expired. Please login again.');
          navigate('/login');
        } else {
          alert('Failed to load documents. Please try again.');
        }
      }
    };

    fetchDocs();
  }, [token, navigate]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a PDF file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      await axios.post('http://localhost:5000/api/docs/upload', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert('PDF uploaded successfully!');
      const allDocs = await axios.get('http://localhost:5000/api/docs/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocs(allDocs.data);
      setFile(null);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload PDF. Please try again.');
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }
    try {
      await axios.delete(`http://localhost:5000/api/docs/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocs((prev) => prev.filter((d) => d._id !== docId));
      alert('Document deleted successfully!');
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Failed to delete document. Please try again.');
    }
  };

  const handleCopyPublicLink = (docId) => {
    const publicUrl = `${window.location.origin}/public-sign/${docId}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(publicUrl)
        .then(() => alert('✅ Public sign link copied to clipboard!'))
        .catch((e) => {
          console.error('Failed to copy public link (Clipboard API issue):', e);
          alert('❌ Failed to copy link. Please copy manually: ' + publicUrl);
        });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = publicUrl;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('✅ Public sign link copied to clipboard!');
      } catch (e) {
        console.error('Fallback: Oops, unable to copy', e);
        alert('❌ Failed to copy link. Please copy manually: ' + publicUrl);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 font-inter transition-colors duration-300">
      <h1 className="text-4xl font-extrabold mb-8 text-purple-800 dark:text-purple-300 text-center tracking-tight drop-shadow-lg">
        <FaFilePdf className="inline-block mr-3 text-5xl text-red-600 dark:text-red-400" /> PDF Document Hub
      </h1>

      <form onSubmit={handleUpload} className="mb-10 p-6 bg-white dark:bg-gray-700 rounded-xl shadow-lg flex flex-col sm:flex-row gap-5 items-center justify-center border border-indigo-200 dark:border-gray-600 transition-colors duration-300">
        <label htmlFor="pdf-upload" className="flex items-center space-x-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-5 py-3 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-900 transition-colors duration-200 ease-in-out shadow-sm border border-gray-300 dark:border-gray-600">
          <FaUpload className="text-xl text-blue-500 dark:text-blue-300" />
          <span className="text-lg font-medium">{file ? file.name : 'Choose PDF to Upload'}</span>
        </label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          className="hidden"
        />
        <button
          type="submit"
          className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold px-8 py-3 rounded-lg shadow-xl hover:from-blue-700 hover:to-indigo-800 transition-all duration-300 ease-in-out transform hover:scale-105 flex items-center gap-2 text-lg"
          disabled={!file}
        >
          <FaUpload /> Upload PDF
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {docs.length === 0 && (
          <p className="col-span-full text-center text-gray-600 dark:text-gray-400 text-xl py-10">
            No documents uploaded yet. Upload your first PDF!
          </p>
        )}
        {docs.map((doc) => (
          <motion.div
            key={doc._id}
            className="relative p-6 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-purple-200 dark:border-gray-600 hover:shadow-2xl transition duration-300 ease-in-out transform hover:-translate-y-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {doc.isFinalized && (
              <div className="absolute top-2 right-2 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                <FaCheckCircle className="text-green-500 dark:text-green-300" /> Finalized
              </div>
            )}

            <p className="font-extrabold text-xl text-indigo-900 dark:text-indigo-200 mb-2 truncate flex items-center">
              <FaFilePdf className="inline-block mr-2 text-red-500 dark:text-red-400" /> {doc.filename}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Uploaded: {new Date(doc.uploadedAt).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 break-words">
              ID: {doc._id}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`http://localhost:5000${doc.filepath.replace(/\\/g, '/')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-semibold hover:bg-purple-600 transition-colors duration-200 shadow-md"
              >
                <FaFilePdf className="mr-2" /> View PDF
              </a>
              <button
                onClick={() => navigate(`/sign-document/${doc._id}`)}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors duration-200 shadow-md"
              >
                <FaSignature className="mr-2" /> Sign
              </button>
              <button
                onClick={() => handleDeleteDoc(doc._id)}
                className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors duration-200 shadow-md"
              >
                <FaTrash className="mr-2" /> Delete
              </button>
              <button
                onClick={() => handleCopyPublicLink(doc._id)}
                className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors duration-200 shadow-md"
              >
                <FaLink className="mr-2" /> Public Link
              </button>

              {doc.isFinalized && doc.finalizedUrl && (
                <>
                  <a
                    href={doc.finalizedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors duration-200 shadow-md"
                  >
                    <FaFilePdf className="mr-2" /> View Signed
                  </a>

                  <a
                    href={doc.finalizedUrl}
                    download
                    className="inline-flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors duration-200 shadow-md"
                  >
                    <FaDownload className="mr-2" /> Download Signed
                  </a>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
