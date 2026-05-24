const { v4: uuidv4 } = require('uuid');

const generateToken = (prefix = 'tok') => `${prefix}_${uuidv4().replace(/-/g, '')}`;

const generateCompanyId = (institutionId) => {
  if (institutionId) return `COMP-${institutionId}`;
  return `COMP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

const generateWalletId = () => `WALLET-${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;

module.exports = { generateToken, generateCompanyId, generateWalletId };
