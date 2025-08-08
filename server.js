const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// --- HIGHLIGHT START: DATABASE INITIALIZATION ---
// The following block of code connects to or creates the 'todos.db' file
// and ensures the 'todos' table exists.
// Initialize the database
const db = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the todos database.');
    // Create table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL
    )`);
});
// --- HIGHLIGHT END ---

// API routes

// GET all todos
app.get('/api/todos', (req, res) => {
    db.all("SELECT * FROM todos ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// POST a new todo
app.post('/api/todos', (req, res) => {
    const { text, status, createdAt } = req.body;
    if (!text || !status || !createdAt) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const sql = `INSERT INTO todos (text, status, createdAt) VALUES (?, ?, ?)`;
    db.run(sql, [text, status, createdAt], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // get the last inserted id
        res.status(201).json({ id: this.lastID, text, status, createdAt });
    });
});

// PUT (update) a todo's status or text
app.put('/api/todos/:id', (req, res) => {
    const { text, status } = req.body;
    const { id } = req.params;

    if (!text && !status) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    let sql;
    let params;

    if (text && status) {
        sql = `UPDATE todos SET text = ?, status = ? WHERE id = ?`;
        params = [text, status, id];
    } else if (text) {
        sql = `UPDATE todos SET text = ? WHERE id = ?`;
        params = [text, id];
    } else { // status
        sql = `UPDATE todos SET status = ? WHERE id = ?`;
        params = [status, id];
    }

    db.run(sql, params, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.json({ message: 'Todo updated successfully' });
    });
});


// DELETE a todo
app.delete('/api/todos/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM todos WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.json({ message: 'Todo deleted successfully' });
    });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});