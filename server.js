const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const JWT_SECRET = 'your-super-secret-key'; // Replace with a strong, secret key in a real app

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Initialize the database
const db = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the todos database.');
});

// --- AUTHENTICATION ROUTES ---

// Register a new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password) VALUES (?, ?)`;
        db.run(sql, [username, hashedPassword], function(err) {
            if (err) {
                // Unique constraint violation
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(409).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'User created successfully', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login a user
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const sql = `SELECT * FROM users WHERE username = ?`;
    db.get(sql, [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Logged in successfully', token });
    });
});


// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.sendStatus(401); // if there's no token
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // if the token is no longer valid
        }
        req.user = user;
        next();
    });
};


// --- PROTECTED TODO ROUTES ---

// GET all todos for the logged-in user
app.get('/api/todos', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all("SELECT * FROM todos WHERE user_id = ? ORDER BY createdAt DESC", [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// POST a new todo for the logged-in user
app.post('/api/todos', authenticateToken, (req, res) => {
    const { text, status, createdAt, details } = req.body;
    const userId = req.user.id;

    if (!text || !status || !createdAt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const sql = `INSERT INTO todos (text, status, createdAt, user_id, details) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [text, status, createdAt, userId, details], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, text, status, createdAt, details });
    });
});

// PUT (update) a todo's status or text for the logged-in user
app.put('/api/todos/:id', authenticateToken, (req, res) => {
    const { text, status, details } = req.body;
    const { id } = req.params;
    const userId = req.user.id;

    if (!text && !status && !details) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    let updates = [];
    let params = [];

    if (text) {
        updates.push('text = ?');
        params.push(text);
    }
    if (status) {
        updates.push('status = ?');
        params.push(status);
    }
    if (details) {
        updates.push('details = ?');
        params.push(details);
    }

    params.push(id, userId);

    const sql = `UPDATE todos SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Todo not found or you do not have permission to update it' });
        }
        res.json({ message: 'Todo updated successfully' });
    });
});

// DELETE a todo for the logged-in user
app.delete('/api/todos/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const sql = 'DELETE FROM todos WHERE id = ? AND user_id = ?';

    db.run(sql, [id, userId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Todo not found or you do not have permission to delete it' });
        }
        res.json({ message: 'Todo deleted successfully' });
    });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
