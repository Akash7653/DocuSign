import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import PDFViewerWithSignature from '../components/PDFViewerWithSignature';
import { motion } from 'framer-motion';

const PublicSign = () => {
  const { token } = useParams();
  const [docUrl, setDocUrl] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/signatures/public-doc/${token}`);
        const fileUrl = `http://localhost:5000${res.data.filepath.replace(/\\/g, '/')}`;
        setDocUrl(fileUrl);
        setSignatures(res.data.signatures || []);
        setLoading(false);
      } catch (err) {
        console.error('❌ Error fetching public document:', err);
        alert('Invalid or expired link.');
        setLoading(false);
      }
    };

    fetchDocument();
  }, [token]);

  const handlePlaceSignature = async ({ x, y, page, type, content }) => {
    try {
      await axios.post(`http://localhost:5000/api/public/${token}`, {
        x,
        y,
        page,
        type,
        content
      });
      alert('✅ Signature placed!');
    } catch (err) {
      console.error('❌ Error placing signature:', err);
      alert('Failed to place signature.');
    }
  };

  const handleDeleteSignature = async (signatureId) => {
    try {
      await axios.delete(`http://localhost:5000/api/signatures/public-delete/${signatureId}`, {
        data: { token }
      });
      setSignatures(prev => prev.filter(sig => sig._id !== signatureId));
      alert('🗑️ Signature deleted!');
    } catch (err) {
      console.error('❌ Error deleting signature:', err);
      alert('Failed to delete signature.');
    }
  };

  const handleFinalize = async () => {
    try {
      const res = await axios.post(`http://localhost:5000/api/public/finalize/${token}`);
      alert('✅ Document finalized!');
      window.open(`http://localhost:5000${res.data.url}`, '_blank');
    } catch (err) {
      console.error('❌ Error finalizing:', err);
      alert('Failed to finalize document.');
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      <motion.div
        className="max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl text-center font-bold mb-6 text-purple-700 dark:text-purple-300 tracking-wide font-serif">
          ✍️ Public Document Signing
        </h2>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-300 text-center animate-pulse">Loading document...</p>
        ) : docUrl ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <PDFViewerWithSignature
              fileUrl={docUrl}
              signatures={signatures}
              onPlaceSignature={handlePlaceSignature}
              onDeleteSignature={handleDeleteSignature}
              onFinalize={handleFinalize}
            />
          </motion.div>
        ) : (
          <p className="text-red-600 font-semibold text-center">Failed to load document.</p>
        )}
      </motion.div>
    </div>
  );
};

export default PublicSign;
