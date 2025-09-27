// -----------------------------------------
// 1. Core Imports
// -----------------------------------------
// Load core libraries (Express for server, MySQL for DB, etc.)
// and configure environment variables.
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import route modules (these are now functions that return routers)
const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todo');

// Import the database initialization function
const { initializeTables } = require('./db/tables');


// -----------------------------------------
// 2. App Initialization
// -----------------------------------------
// Create the Express app instance and set port
const app = express();
const port = process.env.PORT || 8081;

// -----------------------------------------
// 3. Global Middleware & Router Setup
// -----------------------------------------
// Parse incoming JSON requests and attach a
// router for all /api routes
app.use(bodyParser.json());
const apiRouter = express.Router();
app.use('/api', apiRouter);


// -----------------------------------------
// 4. Database Connection & Initialization
// -----------------------------------------
// Create a connection pool for MySQL. In production,
// connect via Unix socket; in local dev, use host/port.
// Run a health check and initialize required tables.
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

        // Call the separate function to initialize tables
        await initializeTables(pool);
        
    } catch (err) {
        console.error('Failed to connect to database or initialize tables:', err);
        throw err;
    }
}


// -----------------------------------------
// 5. Static File Serving
// -----------------------------------------
// Serve static assets from the root directory.
// Fallback to index.html for client-side routing.
app.use(express.static(__dirname));
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

// -----------------------------------------
// 6. Server Startup
// -----------------------------------------
// Export app for testing, or start server directly
// if this file is run as the main module.
module.exports = { app, setupDatabase, pool };
if (require.main === module) {
    setupDatabase()
        .then(() => {
            // Mount routers once pool is initialized
            apiRouter.use(authRoutes(pool));
            apiRouter.use(todoRoutes(pool));
            
            app.listen(port, () => {
                console.log(`Server running on port ${port}`);
            });
        })
        .catch(err => {
            console.error("Failed to start server due to database error:", err);
            process.exit(1);
        });
}
