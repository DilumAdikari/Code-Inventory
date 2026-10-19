require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 2) {
    console.error('Usage: node scripts/create-admin.js <username> <password (min 2 chars)>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const exists = await User.findOne({ username: username.toLowerCase().trim() });
  if (exists) {
    console.error(`User "${username}" already exists`);
  } else {
    await User.create({
      username: username.toLowerCase().trim(),
      password: await bcrypt.hash(password, 10),
      role: 'Admin',
      permissions: { dashboard: true, settings: true, partners: true }
    });
    console.log(`Admin "${username}" created`);
  }
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });