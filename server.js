const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8081;

// Create a new router instance for API routes
const apiRouter = express.Router();

// Middleware
app.use(bodyParser.json());

// Use the API router for all routes starting with /api
app.use('/api', apiRouter);

// Database connection pool setup
let pool;

async function setupDatabase() {
    try {
        let dbConfig;

        // Check if running in a production environment (eg. App Engine)
        if (process.env.NODE_ENV === 'production') {
            // Use a Unix socket for App Engine
            dbConfig = {
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                socketPath: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`,
                connectionLimit: 10,
                multipleStatements: true
            };
        } else {
            // Use host/port for local development
            dbConfig = {
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                host: process.env.DB_HOST,
                port: process.env.DB_PORT || 3306, // Default MySQL port
                connectionLimit: 10,
                multipleStatements: true
            };
        }

        pool = await mysql.createPool(dbConfig);
        
        try {
            const connection = await pool.getConnection();
            await connection.ping();
            connection.release();
            console.log('Connected to Cloud SQL database.');
        } catch (err) {
            console.error('Database health check failed:', err);
            throw err;
        }

        await initializeTables();
        
        } catch (err) {
            console.error('Failed to connect to database or initialize tables:', err);
            throw err;
        }
}

// Alternative approach: Use integer IDs instead of UUIDs
// Replace the initializeTables function and registration route with these:

async function initializeTables() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            passwordChangedAt DATETIME
        );
        CREATE TABLE IF NOT EXISTS todos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            text TEXT NOT NULL,
            status VARCHAR(50) NOT NULL,
            createdAt DATETIME NOT NULL,
            user_id INT NOT NULL,
            details TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `;
    await pool.query(sql);
    console.log('Tables initialized with integer IDs.');
}

// Middleware to authenticate JWT tokens, including temporary tokens for password changes
const authenticateOrRenewToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Forbidden
        }

        // If the token is a temporary token for password change
        if (user.passwordExpired) {
            // Allow access only to the /change-password route
            if (req.path === '/change-password') {
                req.user = user;
                return next();
            } else {
                return res.status(403).json({ error: 'Temporary token valid only for password change.' });
            }
        }

        // For regular tokens, proceed as normal
        req.user = user;
        next();
    });
};

// This registration route
apiRouter.post('/register', async (req, res) => {
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
        // Check if username already exists first
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
        
        // Remove the userId = uuidv4() line, let MySQL auto-increment the ID
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

apiRouter.post('/login', async (req, res) => {
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

        // Automatically flag users with short passwords
        if (user.passwordLength < 60 && !user.forcePasswordReset) {
            console.log(`User ${username} has short password, flagging for reset.`);
            await pool.query(
                'UPDATE users SET forcePasswordReset = TRUE WHERE id = ?',
                [user.id]
            );
            user.forcePasswordReset = true; // Update local object
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('Invalid password for user:', username);
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        // Enforce password reset if flagged or expired
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

        // Issue regular JWT token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed.' });
    }
});




apiRouter.post('/change-password', authenticateOrRenewToken, async (req, res) => {
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

        
        // Issue a new regular token after successful password change
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

// --- Todo Routes using apiRouter ---
apiRouter.get('/todos', authenticateOrRenewToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM todos WHERE user_id = ? ORDER BY createdAt DESC', [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('Get todos error:', err);
        res.status(500).json({ error: 'Failed to retrieve todos.' });
    }
});

apiRouter.post('/todos', authenticateOrRenewToken, async (req, res) => {
    const { text, details } = req.body;
    
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Todo text is required.' });
    }
    
    const status = 'todo';

    // Formats the date for MySQL DATETIME
    const now = new Date();
    const mysqlFormattedDate = now.toISOString().slice(0, 19).replace('T', ' ');

    try {
        const [result] = await pool.query(
            'INSERT INTO todos (text, status, createdAt, user_id, details) VALUES (?, ?, ?, ?, ?)',
            [text, status, mysqlFormattedDate, req.user.id, details || 'Click to add details']
        );
        
        const newTodo = {
            id: result.insertId,
            text,
            status,
            createdAt: mysqlFormattedDate,
            user_id: req.user.id,
            details: details || 'Click to add details'
        };
        
        res.status(201).json(newTodo);
    } catch (err) {
        console.error('Create todo error:', err);
        res.status(500).json({ error: 'Failed to create todo.' });
    }
});

// FIXED: Updated PUT route to handle partial updates properly
apiRouter.put('/todos/:id', authenticateOrRenewToken, async (req, res) => {
    const { id } = req.params;
    const { text, status, details } = req.body;
    
    // Build the update query dynamically based on what fields are provided
    const updateFields = [];
    const values = [];
    
    if (text !== undefined) {
        updateFields.push('text = ?');
        values.push(text);
    }
    if (status !== undefined) {
        updateFields.push('status = ?');
        values.push(status);
    }
    if (details !== undefined) {
        updateFields.push('details = ?');
        values.push(details);
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }
    
    values.push(id, req.user.id); // Add id and user_id for WHERE clause
    
    try {
        const [result] = await pool.query(
            `UPDATE todos SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
            values
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Todo not found or you do not have permission to update it.' });
        }
        
        res.status(200).json({ message: 'Todo updated successfully.' });
    } catch (err) {
        console.error('Update todo error:', err);
        res.status(500).json({ error: 'Failed to update todo.' });
    }
});

apiRouter.delete('/todos/:id', authenticateOrRenewToken, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, req.user.id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Todo not found or you do not have permission to delete it.' });
        }
        
        res.status(200).json({ message: 'Todo deleted successfully.' });
    } catch (err) {
        console.error('Delete todo error:', err);
        res.status(500).json({ error: 'Failed to delete todo.' });
    }
});

// Health check endpoint
apiRouter.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ status: 'unhealthy', database: 'disconnected', timestamp: new Date().toISOString() });
    }
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Catch-all route to serve the index.html for any other requests
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    fs.promises.access(filePath, fs.constants.F_OK)
        .then(() => {
            res.sendFile(filePath);
        })
        .catch(() => {
            console.error('Error: index.html not found in the root directory.');
            res.status(404).send('Not Found');
        });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    setupDatabase();
});