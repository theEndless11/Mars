// profileHandler.js

const { promisePool } = require('../utils/db');

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  setCorsHeaders(res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, hobby, description, profilePicture, Music } = req.body;

  if (!username) return res.status(400).json({ message: 'Username is required' });

  try {
    if (Music !== undefined) {
      await promisePool.execute('UPDATE users SET Music = ? WHERE username = ?', [Music, username]);
    }

    const updates = [];
    const values = [];

    if (hobby !== undefined) {
      updates.push('hobby = ?');
      values.push(hobby);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (profilePicture !== undefined) {
      updates.push('profile_picture = ?');
      values.push(profilePicture);
    }

    if (updates.length) {
      values.push(username);
      await promisePool.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE username = ?`,
        values
      );
    }

    return res.status(200).json({ message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Profile update failed', error: error.message });
  }
};
