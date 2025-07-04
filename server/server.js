const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json());            // Parse JSON body
app.use(cors());                   // Enable CORS

// 🔍 Debug: Log every incoming request
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
});

// 🗂️ Serve uploaded PDF files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('[BOOT] Static file middleware mounted on /uploads');
const testRoutes = require('./routes/authRoutes'); // Or create a new test route file
app.use('/api/auth', testRoutes);

// ========== ROUTES ==========
const authRoutes = require('./routes/authRoutes');
const auditRoutes = require('./routes/auditRoutes');
const documentRoutes = require('./routes/documentRoutes');
const signatureRoutes = require('./routes/signatureRoutes');
const publicSignRoutes = require('./routes/publicSignRoutes');
app.use('/api/public', publicSignRoutes); // ✅ Mount public routes here

console.log('[BOOT] Mounting API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/docs', documentRoutes);       // Documents CRUD
app.use('/api/signatures', signatureRoutes); // Signatures handling
console.log('[BOOT] All routes mounted.');

// 🔐 Test Protected Route
const verifyToken = require('./middleware/authMiddleware');
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ message: `🔒 Protected route accessed by user ${req.user.id}` });
});

// ========== CATCH-ALL HANDLER ==========
app.use((req, res) => {
  console.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'API endpoint not found.' });
});

// ========== OPTIONAL: Serve React Build in Production ==========
/*
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}
*/

// ========== DATABASE ==========
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
