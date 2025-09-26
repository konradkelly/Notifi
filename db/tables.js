
// -----------------------------------------
// Core Imports
// -----------------------------------------
// This file exports a function that initializes
// the database tables required for the application.

// -----------------------------------------
// 1. Users Table
// -----------------------------------------
// The `users` table stores login credentials and
// password-related metadata.
const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        passwordChangedAt DATETIME,
        forcePasswordReset BOOLEAN DEFAULT FALSE
    );
`;

// -----------------------------------------
// 2. Todos Table
// -----------------------------------------
// The `todos` table stores the actual todo items,
// linked to a user by the `user_id` foreign key.
const createTodosTable = `
    CREATE TABLE IF NOT EXISTS todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        text TEXT NOT NULL,
        details TEXT,
        status VARCHAR(50) DEFAULT 'todo',
        createdAt DATETIME,
        user_id INT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`;

// -----------------------------------------
// 3. Initialization Function
// -----------------------------------------
// This function executes the table creation queries.
// It's called from server.js during startup.
async function initializeTables(pool) {
    try {
        console.log('Initializing database tables...');
        await pool.query(createUsersTable);
        await pool.query(createTodosTable);
        console.log('Tables initialized successfully.');
    } catch (err) {
        console.error('Error initializing tables:', err);
        throw err;
    }
}

// -----------------------------------------
// 4. Exports
// -----------------------------------------
// Export the initialization function for use in server.js
module.exports = { initializeTables };
