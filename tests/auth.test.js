require('dotenv').config();
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authRouter = require('../routes/auth');

// Mock the MySQL pool
const mockPool = {
  query: jest.fn(),
};

// Mock bcrypt and jwt
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

// Mock the authenticateOrRenewToken middleware
jest.mock('../src/middleware/auth', () => ({
  authenticateOrRenewToken: jest.fn((req, res, next) => {
    req.user = { id: 1 }; // Mock a valid user
    next();
  }),
}));

// Create an Express app for testing
const app = express();
app.use(express.json());
app.use(authRouter(mockPool));

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    test('should register a new user successfully', async () => {
      mockPool.query
        .mockResolvedValueOnce([[]]) // No existing users
        .mockResolvedValueOnce([{ insertId: 1 }]); // Successful insert
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashed_password');

      const response = await request(app)
        .post('/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ message: 'User registered successfully.' });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE username = ?',
        ['testuser']
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO users (username, password, passwordChangedAt) VALUES (?, ?, ?)',
        ['testuser', 'hashed_password', expect.any(String)]
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
    });

    test('should reject if username is missing', async () => {
      const response = await request(app)
        .post('/register')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Username and password are required.' });
    });

    test('should reject if username is too short', async () => {
      const response = await request(app)
        .post('/register')
        .send({ username: 'test', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Username must be at least 5 characters long.' });
    });

    test('should reject if password is too short', async () => {
      const response = await request(app)
        .post('/register')
        .send({ username: 'testuser', password: 'pass' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Password must be at least 8 characters long.' });
    });

    test('should reject if username already exists', async () => {
      mockPool.query.mockResolvedValueOnce([[{ id: 1 }]]); // Existing user

      const response = await request(app)
        .post('/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'Username already exists.' });
    });

    test('should handle database errors', async () => {
      mockPool.query.mockRejectedValueOnce({ code: 'ER_SOME_ERROR' });

      const response = await request(app)
        .post('/register')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Registration failed. Please try again.' });
    });
  });

  describe('POST /login', () => {
    test('should login successfully with valid credentials', async () => {
      mockPool.query.mockResolvedValueOnce([[
        { id: 1, username: 'testuser', password: 'hashed_password', forcePasswordReset: false, passwordChangedAt: new Date() }
      ]]);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('jwt_token');

      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ token: 'jwt_token' });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(jwt.sign).toHaveBeenCalledWith({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    test('should require password reset for expired password', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      mockPool.query.mockResolvedValueOnce([[
        { id: 1, username: 'testuser', password: 'hashed_password', forcePasswordReset: false, passwordChangedAt: thirtyOneDaysAgo, passwordLength: 60, passwordExpired: true }
      ]]);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('temp_token');

      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Password must be reset before logging in.',
        passwordExpired: true,
        tempToken: 'temp_token'
      });
      expect(jwt.sign).toHaveBeenCalledWith({ id: 1, passwordExpired: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
    });

    test('should flag short password and require reset', async () => {
      mockPool.query
        .mockResolvedValueOnce([[
          { id: 1, username: 'testuser', password: 'hashed_password', forcePasswordReset: false, passwordChangedAt: new Date(), passwordLength: 50 }
        ]])
        .mockResolvedValueOnce([]); // Update query
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('temp_token');

      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Password must be reset before logging in.',
        passwordExpired: true,
        tempToken: 'temp_token'
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET forcePasswordReset = TRUE WHERE id = ?',
        [1]
      );
    });

    test('should reject invalid credentials', async () => {
      mockPool.query.mockResolvedValueOnce([[]]); // No user found

      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid username or password.' });
    });
  });

  describe('POST /request-password-reset', () => {
    test('should generate temp token for valid username', async () => {
      mockPool.query.mockResolvedValueOnce([[{ id: 1 }], []]); // User found
      jwt.sign.mockReturnValue('temp_token');

      const response = await request(app)
        .post('/request-password-reset')
        .send({ username: 'testuser' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ tempToken: 'temp_token' });
      expect(jwt.sign).toHaveBeenCalledWith({ id: 1, passwordExpired: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
    });

    test('should reject if username is missing', async () => {
      const response = await request(app)
        .post('/request-password-reset')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Username is required.' });
    });

    test('should reject if user not found', async () => {
      mockPool.query.mockResolvedValueOnce([[]]); // No user

      const response = await request(app)
        .post('/request-password-reset')
        .send({ username: 'testuser' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found.' });
    });
  });

  describe('POST /change-password', () => {
    test('should change password successfully', async () => {
      mockPool.query.mockResolvedValueOnce([]); // Update query
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('new_token');

      const response = await request(app)
        .post('/change-password')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Password changed successfully.', token: 'new_token' });
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET password = ?, passwordChangedAt = ?, forcePasswordReset = FALSE WHERE id = ?',
        ['hashed_password', expect.any(String), 1]
      );
      expect(jwt.sign).toHaveBeenCalledWith({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    });

    test('should reject if password is too short', async () => {
      const response = await request(app)
        .post('/change-password')
        .send({ password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Password must be at least 8 characters long.' });
    });

    test('should handle database errors', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .post('/change-password')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to change password.' });
    });
  });
});