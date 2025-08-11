const sqlite3 = require('sqlite3').verbose();

// Connect to the database
const db = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        return console.error('Error connecting to the database:', err.message);
    }
    console.log('Connected to the todos database.');
});

// SQL statements
const createUsersTable = `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);`;

const addUserIdColumn = `ALTER TABLE todos ADD COLUMN user_id INTEGER;`;

const addDetailsColumn = `ALTER TABLE todos ADD COLUMN details TEXT;`;

// Use a function to run statements and close the DB
const setupDatabase = () => {
    db.serialize(() => {
        // Create users table
        db.run(createUsersTable, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('Successfully created or ensured users table exists.');
            }
        });

        // Check if 'user_id' column exists
        db.all("PRAGMA table_info(todos)", (err, columns) => {
            if (err) {
                return console.error("Error getting table info:", err.message);
            }

            const userIdColumnExists = columns.some(col => col.name === 'user_id');

            if (!userIdColumnExists) {
                db.run(addUserIdColumn, (err) => {
                    if (err) {
                        console.error('Error adding user_id column to todos:', err.message);
                    } else {
                        console.log('Successfully added user_id column to todos table.');
                    }
                });
            } else {
                console.log('user_id column already exists in todos table.');
            }

            const detailsColumnExists = columns.some(col => col.name === 'details');

            if (!detailsColumnExists) {
                db.run(addDetailsColumn, (err) => {
                    if (err) {
                        console.error('Error adding details column to todos:', err.message);
                    } else {
                        console.log('Successfully added details column to todos table.');
                    }
                    // Close the database connection after the last operation
                    closeDatabase();
                });
            } else {
                console.log('details column already exists in todos table.');
                // Close the database connection if the column already exists
                closeDatabase();
            }
        });
    });
};

const closeDatabase = () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing the database connection:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
};

// Run the setup
setupDatabase();