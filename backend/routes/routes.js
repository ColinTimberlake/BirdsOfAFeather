/* ### Auth Routes
POST	/auth/register	Creates a new user
POST	/auth/login	Authenticates user and returns JWT */
const jwt= require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const express=require('express');
const app=express();
const path=require('path');
const fs=require('fs');
const crypto= require('crypto');
const bcryptjs= require('bcryptjs');
const authController = require('../controllers/auth.controller.js');

app.use(express.json());
app.use(express.static("public"));

const authenticateToken = async(req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Token received:', token);
  console.log('Secret being used:', 'your-jwt-secret-key');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify JWT (use promise version)
    const user = jwt.verify(token, 'your_jwt_secret_key'); // Use the same secret from login!
    
    // Check if token is blacklisted
    const session = await prisma.session.findUnique({ where: { token } });
    
    if (!session || session.blacklisted) {
      return res.status(403).json({ error: 'Token has been revoked' });
    }
    
    // Everything passed - attach user to request and continue
    req.user = user;
    next();
    
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Helper functions to read and write users and sessions
readUsers = () => {
  const data = fs.readFileSync('users.json', 'utf8');
  const parsed = JSON.parse(data);
  return parsed.users;
};

writeUsers = (data) =>{
  const fileData = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  fileData.users=data;
  fs.writeFileSync('users.json', JSON.stringify(fileData, null, 2));
};

readSessions = () => {
  const data = fs.readFileSync('users.json', 'utf8');
  console.log('Raw data:', data);
  const parsed = JSON.parse(data);
  console.log('Parsed data:', parsed);
  console.log('parsed.users:', parsed.users);
  return parsed.sessions;
};

writeSessions = (data) => {
  const fileContent = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  fileContent.sessions = data;
  fs.writeFileSync('users.json', JSON.stringify(fileContent, null, 2));
};

// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
},);

app.get('/api/users/me', authenticateToken, async (req, res) => {
  // req.user contains the decoded JWT data (userId, email)
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't send back the password!
    const { hashedPassword, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* User Routes
Method	Endpoint	Description
GET	/users/me	Returns logged-in user info
PUT	/users/me	Updates user profile
DELETE	/users/me	Deletes user account

Requires Authorization: Bearer <token> */