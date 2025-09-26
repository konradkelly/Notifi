// Required imports for the authentication middleware
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Needed to access process.env.JWT_SECRET

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

// Export the middleware so it can be used in your main server file
module.exports = {
    authenticateOrRenewToken
};