const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Document = require('../models/Document');
const generateSignatureToken = require('../utils/generateSignatureToken');

const JWT_SECRET = process.env.JWT_SECRET;

// ===================
// REGISTER
// ===================
exports.register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================
// LOGIN
// ===================
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ===================
// GENERATE PUBLIC LINK
// ===================
exports.generatePublicLink = async (req, res) => {
  try {
    const { documentId } = req.body;

    const doc = await Document.findById(documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const token = generateSignatureToken({ documentId: doc._id });
    const publicUrl = `http://localhost:3000/public-sign/${token}`;

    res.status(200).json({
      message: 'Public signing link generated',
      url: publicUrl,
      token
    });
  } catch (err) {
    console.error('❌ Error generating public link:', err);
    res.status(500).json({ message: 'Failed to generate public link', error: err.message });
  }
};

// ===================
// MANUAL TOKEN TEST
// ===================
exports.manualToken = (req, res) => {
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ message: 'documentId is required' });

  try {
    const token = generateSignatureToken({ documentId });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Token generation failed', error: err.message });
  }
};
