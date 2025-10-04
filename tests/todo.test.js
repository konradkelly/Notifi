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
        it('should return all todos for authenticated user', async () => {
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

        it('should return empty array when user has no todos', async () => {
            mockPool.query.mockResolvedValue([[]]);

            const response = await request(app).get('/api/todos');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        it('should handle database errors', async () => {
            mockPool.query.mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/api/todos');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'Failed to retrieve todos.' });
        });
    });
});