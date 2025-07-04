import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PDFViewerWithSignature from '../components/PDFViewerWithSignature';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const SignDocumentPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      toast.error('You must be logged in to sign documents.');
      navigate('/login');
      return;
    }

    const api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const handleApiError = (err) => {
      console.error('API Error:', err);
      
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          toast.error('Session expired. Please login again.');
          navigate('/login');
        } else if (err.response.status === 404) {
          setError(`Document not found. It may have been deleted.`);
        } else {
          setError(err.response.data?.message || `Error: ${err.response.status}`);
        }
      } else if (err.request) {
        setError('Network error: Could not connect to server');
      } else {
        setError('An unexpected error occurred');
      }
    };

    const fetchDocumentAndSignatures = async () => {
      try {
        setLoading(true);
        setError(null);

        const [docRes, sigRes] = await Promise.all([
          api.get(`/api/docs/${docId}`),
          api.get(`/api/signatures/${docId}`)
        ]);

        const filepath = docRes.data.filepath.startsWith('/') 
          ? docRes.data.filepath 
          : `/${docRes.data.filepath}`;

        setSelectedDoc({
          _id: docRes.data._id,
          url: `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${filepath}`,
          filename: docRes.data.filename,
          isFinalized: docRes.data.isFinalized || false
        });

        setSignatures(sigRes.data);
      } catch (err) {
        handleApiError(err);
      } finally {
        setLoading(false);
      }
    };

    if (docId) {
      fetchDocumentAndSignatures();
    }
  }, [docId, token, navigate]);

  const handlePlaceSignature = async (signatureData) => {
    if (!selectedDoc || selectedDoc.isFinalized) return;

    try {
      setIsProcessing(true);
      const api = axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const normalizedContent = {
        text: signatureData.content?.text || '',
        fontSize: signatureData.content?.fontSize || 18,
        color: signatureData.content?.color || '#000000',
        type: signatureData.type || 'typed'
      };

      const res = await api.post('/api/signatures', {
        documentId: selectedDoc._id,
        ...signatureData,
        content: normalizedContent
      });

      setSignatures(prev => [...prev, res.data]);
      toast.success('Signature placed successfully!');
    } catch (err) {
      console.error('API Error:', err);
      toast.error(err.response?.data?.message || 'Failed to place signature');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSignature = async (signatureId) => {
    if (!selectedDoc || selectedDoc.isFinalized) return;
    
    if (!window.confirm('Are you sure you want to delete this signature?')) {
      return;
    }

    try {
      setIsProcessing(true);
      const api = axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      await api.delete(`/api/signatures/${signatureId}`);
      setSignatures(prev => prev.filter(sig => sig._id !== signatureId));
      toast.success('Signature deleted!');
    } catch (err) {
      console.error('API Error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete signature');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedDoc || selectedDoc.isFinalized) return;

    if (!window.confirm('Finalize this document? This cannot be undone.')) {
      return;
    }

    try {
      setIsProcessing(true);
      const api = axios.create({
        baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const res = await api.post('/api/signatures/finalize', {
        documentId: selectedDoc._id
      });

      const finalizedUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${res.data.url}`;
      
      setSelectedDoc(prev => ({
        ...prev,
        url: finalizedUrl,
        isFinalized: true
      }));

      const downloadLink = document.createElement('a');
      downloadLink.href = finalizedUrl;
      downloadLink.download = res.data.filename || `signed_${selectedDoc.filename}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      toast.success('Document finalized and downloaded!');
    } catch (err) {
      console.error('API Error:', err);
      toast.error(err.response?.data?.message || 'Failed to finalize document');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
        <div className="text-center text-2xl font-semibold text-purple-700 dark:text-purple-300 flex items-center space-x-3">
          <FaSpinner className="animate-spin text-4xl" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-800 dark:to-red-900 p-4 text-center">
        <FaExclamationCircle className="text-6xl mb-4 text-red-600 dark:text-red-300" />
        <h2 className="text-2xl font-bold mb-2 text-red-700 dark:text-red-200">Error Loading Document</h2>
        <p className="mb-6 text-lg text-red-600 dark:text-red-300">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary bg-red-600 hover:bg-red-700"
        >
          <FaArrowLeft className="mr-2" /> Back to Dashboard
        </button>
      </div>
    );
  }

  if (!selectedDoc) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-100 dark:bg-gray-800 p-4 text-center">
        <FaExclamationCircle className="text-6xl mb-4 text-gray-600 dark:text-gray-300" />
        <p className="mb-6 text-lg text-gray-700 dark:text-gray-300">Document details could not be loaded.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary bg-gray-600 hover:bg-gray-700"
        >
          <FaArrowLeft className="mr-2" /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-full mx-auto min-h-[calc(100vh-80px)] bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-800 dark:to-gray-900">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-secondary"
        >
          <FaArrowLeft className="mr-2" /> Back
        </button>
        <h1 className="flex-grow text-3xl md:text-4xl font-extrabold text-blue-800 dark:text-blue-300 text-center">
          {selectedDoc.isFinalized ? '✅ ' : '✍️ '} 
          {selectedDoc.filename}
        </h1>
        <div className="w-[180px] sm:w-auto"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="mt-6 border border-blue-200 dark:border-gray-600 p-6 rounded-xl bg-white dark:bg-gray-700 shadow-2xl"
      >
        {isProcessing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-xl">
            <FaSpinner className="animate-spin text-4xl text-white" />
          </div>
        )}
        
        <PDFViewerWithSignature
          fileUrl={selectedDoc.url}
          signatures={signatures}
          onPlaceSignature={handlePlaceSignature}
          onDeleteSignature={handleDeleteSignature}
          onFinalize={selectedDoc.isFinalized ? null : handleFinalize}
          isFinalized={selectedDoc.isFinalized}
        />
      </motion.div>
    </div>
  );
};

export default SignDocumentPage;