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


app.use(express.json());
app.use(express.static("public"));

const authenticateToken = async(req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify JWT (use promise version)
    const user = jwt.verify(token, 'your-secret-key'); // Use the same secret from login!
    
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


// Auth Routes For User Registration 
app.post('/api/register', async (req, res) => {
  const { user, email, password } = req.body;

  console.log('Received registration data:', req.body);
  //makes sure all fields are filled out
  if (!user || !email || !password) {
    return res.status(400).json({ error: 'This is wrong' });
  }

  // Password validation and Strength Checking
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Check for at least one special character
  if(!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one special character' });
  }

  // Check for at least one lowercase letter, one uppercase letter, and one number
  if(!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one lowercase letter, one uppercase letter, and one number' });
  }
  console.log('Password validation passed');
  // Hash the password before storing it
  //const users = readUsers();
  const currentEmail = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (currentEmail) {
    return res.status(400).json({ error: 'Email is already in use' });
  }
  const currentUser = await prisma.user.findUnique({ where: { user: req.body.user } });
  if (currentUser) {
    return res.status(400).json({ error: 'User is already in use' });
  }
  const hashedPassword = bcryptjs.hashSync(req.body.password, 10);
  try {
    const newUser= await prisma.user.create({
      data: {
        user: req.body.user,
        email: req.body.email,
        hashedPassword: hashedPassword
      }
    });
    console.log('all tests passed');
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error){
    console.log('Full error:', error);
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    return res.status(500).json({ error: 'Database error', details: error.message });
  };
});

// Auth Routes For User Login
app.post('/api/login', async(req, res) => {
  const { user, email, password } = req.body;

  //makes sure all fields are filled out
  if (!user || !email || !password) {
    return res.status(400).json({ error: 'user, email, or password is incorrect' });
  }

  // Password validation and Strength Checking
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }


  const currentEmail = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!currentEmail) {
    return res.status(400).json({ error: 'There is no account with that email' });
  }
  // Find user by email
  const foundUser = await prisma.user.findUnique({ where: { email: req.body.email } });
  
  // Check if user exists
  if(!foundUser) {
    return res.status(404).json({error: 'No User Has Been Found'});
  }

  // Check if password is correct
  if(!bcryptjs.compareSync(req.body.password, foundUser.hashedPassword)) {
    return res.status(400).json({error: "Password is Incorrect"});
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: foundUser.id, email: foundUser.email },
    'your_jwt_secret_key', // Replace with your secret key
    { expiresIn: '1h' } // Token expiration time
  );

  res.status(200).json({ token });
  console.log('User logged in successfully');

  // Calculate expiration time (1 hour from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Save session to database
  await prisma.session.create({
    data: {
      token: token,
      userId: foundUser.id,
      expiresAt: expiresAt,
      blacklisted: false
    }
  });
});

// Auth Routes For User Logout
app.post('/api/logout', async(req, res) => {
  const {token} = req.body;

  //makes sure all fields are filled out
  if (!token) {
    return res.status(400).json({ error: 'Token not found' });
  }  

  try {
    await prisma.session.update({
      where: { token },
      data: { blacklisted: true }
    });
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.log('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/* User Routes
Method	Endpoint	Description
GET	/users/me	Returns logged-in user info
PUT	/users/me	Updates user profile
DELETE	/users/me	Deletes user account

Requires Authorization: Bearer <token> */