const request = require('supertest');
const express = require('express');
const todoRoutes = require('../routes/todo');

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
});
// Mock the auth middleware
jest.mock('../src/middleware/auth.js', () => ({
    authenticateOrRenewToken: (req, res, next) => {
        req.user = { id: 1 }; // Mock user
        next();
    }
}));

describe('Todo Routes', () => {
    let app;
    let mockPool;

    beforeEach(() => {
        // Create a fresh Express app for each test
        app = express();
        app.use(express.json());

        // Mock the database pool
        mockPool = {
            query: jest.fn()
        };

        // Mount the routes
        app.use('/api', todoRoutes(mockPool));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/todos', () => {
        test('should return all todos for authenticated user', async () => {
            const mockTodos = [
                { id: 1, text: 'Test todo 1', status: 'todo', user_id: 1, createdAt: '2025-01-01 12:00:00' },
                { id: 2, text: 'Test todo 2', status: 'done', user_id: 1, createdAt: '2025-01-02 12:00:00' }
            ];

            mockPool.query.mockResolvedValue([mockTodos]);

            const response = await request(app).get('/api/todos');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockTodos);
            expect(mockPool.query).toHaveBeenCalledWith(
                'SELECT * FROM todos WHERE user_id = ? ORDER BY createdAt DESC',
                [1]
            );
        });

        test('should return empty array when user has no todos', async () => {
            mockPool.query.mockResolvedValue([[]]);

            const response = await request(app).get('/api/todos');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        test('should handle database errors', async () => {
            mockPool.query.mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/api/todos');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to retrieve todos.' });
        });
        
        describe('PUT /api/todos/:id', () => {
        test('should update todo text', async () => {
            mockPool.query.mockResolvedValue([{ affectedRows: 1 }]);

            const response = await request(app)
                .put('/api/todos/1')
                .send({ text: 'Updated text' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ message: 'Todo updated successfully.' });
            expect(mockPool.query).toHaveBeenCalledWith(
                'UPDATE todos SET text = ? WHERE id = ? AND user_id = ?',
                ['Updated text', '1', 1]
            );
        });
        
        test('should update todo status', async () => {
            mockPool.query.mockResolvedValue([{ affectedRows: 1 }]);

            const response = await request(app)
                .put('/api/todos/1')
                .send({ status: 'done' });

            expect(response.status).toBe(200);
            expect(mockPool.query).toHaveBeenCalledWith(
                'UPDATE todos SET status = ? WHERE id = ? AND user_id = ?',
                ['done', '1', 1]
            );
        });

        test('should update todo details', async () => {
            mockPool.query.mockResolvedValue([{ affectedRows: 1 }]);

            const response = await request(app)
                .put('/api/todos/1')
                .send({ details: 'Updated details' });

            expect(response.status).toBe(200);
        });

        test('should update multiple fields at once', async () => {
            mockPool.query.mockResolvedValue([{ affectedRows: 1 }]);

            const response = await request(app)
                .put('/api/todos/1')
                .send({ text: 'New text', status: 'done', details: 'New details' });

            expect(response.status).toBe(200);
            expect(mockPool.query).toHaveBeenCalledWith(
                'UPDATE todos SET text = ?, status = ?, details = ? WHERE id = ? AND user_id = ?',
                ['New text', 'done', 'New details', '1', 1]
            );
        });

        test('should reject update with no fields', async () => {
            const response = await request(app)
                .put('/api/todos/1')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'No fields to update.' });
            expect(mockPool.query).not.toHaveBeenCalled();
        });

        test('should return 404 when todo not found', async () => {
            mockPool.query.mockResolvedValue([{ affectedRows: 0 }]);

            const response = await request(app)
                .put('/api/todos/999')
                .send({ text: 'Updated text' });

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ 
                error: 'Todo not found or you do not have permission to update it.' 
            });
        });

        test('should handle database errors during update', async () => {
            mockPool.query.mockRejectedValue(new Error('Update failed'));

            const response = await request(app)
                .put('/api/todos/1')
                .send({ text: 'Updated text' });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to update todo.' });
        });
    });        
    });
});