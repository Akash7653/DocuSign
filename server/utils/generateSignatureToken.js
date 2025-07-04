const jwt = require('jsonwebtoken');

const generateSignatureToken = (payload) => {
  const token = jwt.sign(payload, process.env.EXTERNAL_JWT_SECRET, { expiresIn: '1d' });
  console.log('[DEBUG] Generated Token Payload:', payload);
  console.log('[DEBUG] JWT:', token);
  return token;
};

module.exports = generateSignatureToken;
