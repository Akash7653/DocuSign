const express = require('express');
const router = express.Router();
const {
  register,
  login,
  generatePublicLink,
  manualToken
} = require('../controllers/authController');

// Auth endpoints
router.post('/register', register);
router.post('/login', login);

// Public link generation
router.post('/generate-public-link', generatePublicLink);

// Token generation for testing in Postman
router.post('/generate-token', manualToken);

module.exports = router;
