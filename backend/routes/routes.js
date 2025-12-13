/* ### Auth Routes
POST	/auth/register	Creates a new user
POST	/auth/login	Authenticates user and returns JWT */
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

  // Hash the password before storing it
  //const users = readUsers();
  const currentUser = await prisma.user.findUnique({ where: { email: email } });
  if (currentUser) {
    return res.status(400).json({ error: 'Email is already in use' });
  }
  const hashedPassword = bcryptjs.hashSync(req.body.password, 10);
  const newUser = {
    id: Math.max(...users.map(env => env.id), 0) + 1,
    user: req.body.user,
    email: req.body.email,
    hashedPassword:hashedPassword,
    createdAt: new Date()
  };

  // Add the new user to the users array and write to the file
  users.push(newUser);
  writeUsers(users);
  res.status(201).json(newUser);
});


// Auth Routes For User Login
app.post('/api/login', (req, res) => {
  const { user, email, password } = req.body;

  //makes sure all fields are filled out
  if (!user || !email || !password) {
    return res.status(400).json({ error: 'user, email, or password is incorrect' });
  }

  // Password validation and Strength Checking
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Check for at least one special character
  const users = readUsers();
  const sessions = readSessions();
  
  // Find user by email
  const foundUser = users.find(u => u.email === req.body.email);

  // Check if user exists
  if(!foundUser) {
    return res.status(404).json({error: 'No User Has Been Found'});
  }

  // Check if password is correct
  if(!bcryptjs.compareSync(req.body.password, foundUser.hashedPassword)) {
    return res.status(400).json({error: "Password is Incorrect"});
  }

  // Create a new session
  const sessionToken= crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expirationTime = now.getTime() + 60 * 60 * 1000; // Calculate expiration in milliseconds

  // Create session data object
  const sessionData = {
    token: sessionToken,
    userId: foundUser.id,
    expiresAt: expirationTime,
    createdAt: now
  };

  // Add the new session to the sessions array and write to the file
  sessions.push(sessionData);
  writeSessions(sessions);
  res.status(201).json(sessionData);
});

// Auth Routes For User Logout
app.post('/api/logout', (req, res) => {
  const { user, email, password} = req.body;

  //makes sure all fields are filled out
  if (!user || !email || !password) {
    return res.status(400).json({ error: 'user not found' });
  }  

  const users= readUsers();
  const sessions=readSessions();

  // Find user by email
  const foundUser = users.find(u => u.email === req.body.email);

  // Check if user exists
  if(!foundUser) {
    return res.status(404).json({error: 'No User Has Been Found'});
  }

  // Check if password is correct
  if(!bcryptjs.compareSync(req.body.password, foundUser.hashedPassword)) {
    return res.status(400).json({error: "Password is Incorrect"});
  }

  // Remove the user's session
  const updatedSessions = sessions.filter(session => session.userId !== foundUser.id);

  // Update the sessions array and write to the file
  sessions.push(updatedSessions);
  writeSessions(updatedSessions);
  res.status(201).json("Session token succesfully removed");
});

/* User Routes
Method	Endpoint	Description
GET	/users/me	Returns logged-in user info
PUT	/users/me	Updates user profile
DELETE	/users/me	Deletes user account

Requires Authorization: Bearer <token> */