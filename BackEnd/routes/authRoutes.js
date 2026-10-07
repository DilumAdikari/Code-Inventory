const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// 1. LOGIN ENDPOINT
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid username or password' });

    res.json({ 
      token: 'mock-jwt-token-green-erp-xyz', 
      role: user.role, 
      username: user.username,
      permissions: user.permissions // Frontend එකේදී පාවිච්චි කිරීමට පර්මිෂන්ස් ද යවයි
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. GET ALL USERS (පර්මිෂන් මැට්‍රික්ස් එක සඳහා සියලුම යූසර්ලා ඇදීම)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. REGISTER NEW USER
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userExists = await User.findOne({ username: username.toLowerCase().trim() });
    if (userExists) return res.status(400).json({ message: 'Username already taken.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      permissions: { dashboard: true } // අලුතින් හදන අයට default ඩෑෂ්බෝඩ් විතරක් ඇරේ
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. UPDATE USER PERMISSIONS DIRECTLY
router.put('/users/:id/permissions', async (req, res) => {
  const { permissions } = req.body;
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { permissions },
      { new: true }
    ).select('-password');
    res.json({ message: 'Access controls updated successfully!', updatedUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;