const express = require('express');
const { authenticateOrRenewToken } = require('../src/middleware/auth.js');

module.exports = (pool) => {
    const apiRouter = express.Router();

    // Todo Routes using apiRouter
    apiRouter.get('/todos', authenticateOrRenewToken, async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM todos WHERE user_id = ? ORDER BY createdAt DESC', [req.user.id]);
            res.json(rows);
        } catch (err) {
            console.error('Get todos error:', err);
            res.status(500).json({ error: 'Failed to retrieve todos.' });
        }
    });

    // This creates a todo route
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

    // This updates a todo route
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
    return apiRouter;
};