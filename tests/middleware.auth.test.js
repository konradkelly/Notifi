// tests/middleware.auth.test.js
require('dotenv').config();
const { authenticateOrRenewToken } = require('../src/middleware/auth');
const jwt = require('jsonwebtoken');

// Mock jwt.verify
jest.mock('jsonwebtoken');

describe('authenticateOrRenewToken Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
      path: '/',
    };
    res = {
      sendStatus: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should return 401 if no token provided', () => {
    authenticateOrRenewToken(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if token is invalid', () => {
    req.headers['authorization'] = 'Bearer invalid_token';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(new Error('Invalid token'), null);
    });

    authenticateOrRenewToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('invalid_token', process.env.JWT_SECRET, expect.any(Function));
    expect(res.sendStatus).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('should allow regular token and call next', () => {
    req.headers['authorization'] = 'Bearer valid_token';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { id: 1 });
    });

    authenticateOrRenewToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid_token', process.env.JWT_SECRET, expect.any(Function));
    expect(req.user).toEqual({ id: 1 });
    expect(next).toHaveBeenCalled();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  test('should allow temporary token for /change-password', () => {
    req.headers['authorization'] = 'Bearer temp_token';
    req.path = '/change-password';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { id: 1, passwordExpired: true });
    });

    authenticateOrRenewToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('temp_token', process.env.JWT_SECRET, expect.any(Function));
    expect(req.user).toEqual({ id: 1, passwordExpired: true });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should reject temporary token for non-/change-password routes', () => {
    req.headers['authorization'] = 'Bearer temp_token';
    req.path = '/other-route';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { id: 1, passwordExpired: true });
    });

    authenticateOrRenewToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('temp_token', process.env.JWT_SECRET, expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Temporary token valid only for password change.' });
    expect(next).not.toHaveBeenCalled();
  });
});