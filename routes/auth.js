// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateOrRenewToken } = require('../src/middleware/auth.js');

module.exports = (pool) => {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    console.log('Registration attempt for username:', username);

    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username.length < 5) {
      console.log('Username too short:', username);
      return res.status(400).json({ error: 'Username must be at least 5 characters long.' });
    }

    if (password.length < 8) {
      console.log('Password too short for user:', username);
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    try {
      console.log('Checking if username exists:', username);
      const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existingUsers.length > 0) {
        console.log('Username already exists:', username);
        return res.status(409).json({ error: 'Username already exists.' });
      }

      console.log('Creating new user:', username);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const now = new Date();
      const mysqlFormattedDate = now.toISOString().slice(0, 19).replace('T', ' ');

      const [result] = await pool.query('INSERT INTO users (username, password, passwordChangedAt) VALUES (?, ?, ?)', [username, hashedPassword, mysqlFormattedDate]);
      console.log('User created successfully:', username, 'with ID:', result.insertId);

      res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
      console.error('Registration error for user:', username, 'Error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username already exists.' });
      }
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT *,
            (passwordChangedAt < DATE_SUB(NOW(), INTERVAL 30 DAY)) AS passwordExpired,
            forcePasswordReset,
            CHAR_LENGTH(password) AS passwordLength
        FROM users
        WHERE username = ?`,
        [username]
      );

      if (rows.length === 0) {
        console.log('User not found:', username);
        return res.status(400).json({ error: 'Invalid username or password.' });
      }

      const user = rows[0];

      if (user.passwordLength < 60 && !user.forcePasswordReset) {
        console.log(`User ${username} has short password, flagging for reset.`);
        await pool.query(
          'UPDATE users SET forcePasswordReset = TRUE WHERE id = ?',
          [user.id]
        );
        user.forcePasswordReset = true;
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log('Invalid password for user:', username);
        return res.status(400).json({ error: 'Invalid username or password.' });
      }

      if (user.forcePasswordReset || user.passwordExpired) {
        console.log('Password reset required for user:', username);
        const tempToken = jwt.sign(
          { id: user.id, passwordExpired: true },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );
        return res.status(401).json({
          error: 'Password must be reset before logging in.',
          passwordExpired: true,
          tempToken
        });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  router.post('/request-password-reset', async (req, res) => {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    try {
      const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const user = rows[0];
      const tempToken = jwt.sign(
        { id: user.id, passwordExpired: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      res.json({ tempToken });
    } catch (err) {
      console.error('Password reset request error:', err);
      res.status(500).json({ error: 'Failed to process password reset request.' });
    }
  });

  router.post('/change-password', authenticateOrRenewToken, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const now = new Date();
      const mysqlFormattedDate = now.toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(
        'UPDATE users SET password = ?, passwordChangedAt = ?, forcePasswordReset = FALSE WHERE id = ?',
        [hashedPassword, mysqlFormattedDate, req.user.id]
      );

      const newToken = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.json({
        message: 'Password changed successfully.',
        token: newToken
      });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Failed to change password.' });
    }
  });

  return router;
};