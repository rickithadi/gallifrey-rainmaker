const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { AppError, catchAsync } = require('./errorHandler');
const { logger } = require('../utils/logger');

// Simple authentication middleware for API endpoints
const authMiddleware = catchAsync(async (req, res, next) => {
  // 1) Check if token exists
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // For Google Apps Script requests, check for custom header
  if (!token && req.headers['x-apps-script-auth']) {
    token = req.headers['x-apps-script-auth'];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please provide a valid token.', 401));
  }

  // 2) Verify token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    return next(error);
  }

  // 3) Log the authenticated request
  logger.info('Authenticated request', {
    userId: decoded.id,
    email: decoded.email,
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // 4) Grant access to protected route
  req.user = decoded;
  next();
});

// Create JWT token
const signToken = (id, email) => {
  return jwt.sign(
    { id, email },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

// Send JWT token as response
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id, user.email);
  
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// Optional auth middleware (doesn't require authentication)
const optionalAuth = (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Ignore authentication errors for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
  }

  next();
};

// Role-based access control
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

// API key authentication for external services
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new AppError('API key required', 401));
  }

  // In a real implementation, you would validate against stored API keys
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    return next(new AppError('Invalid API key', 401));
  }

  // Log API key usage
  logger.info('API key authentication', {
    apiKey: apiKey.substring(0, 8) + '...',
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  next();
};

module.exports = {
  authMiddleware,
  optionalAuth,
  restrictTo,
  apiKeyAuth,
  signToken,
  createSendToken
};