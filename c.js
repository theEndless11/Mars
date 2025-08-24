const { promisePool } = require('../utils/db');

const allowedOrigins = [
  'https://latestnewsandaffairs.site',
  'http://localhost:5173'
];

const setCorsHeaders = (req, res) => {
  const o = req.headers.origin;
  if (allowedOrigins.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

// Valid categories from your existing system
const VALID_CATEGORIES = [
  'News',
  'Sports', 
  'Entertainment',
  'Story/Rant'
];

const handler = async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // GET /api/classify-posts - Get unclassified posts for review
    try {
      const { limit = 100 } = req.query;
      
      const [posts] = await promisePool.execute(
        `SELECT _id, message, username, timestamp, categories 
         FROM posts 
         WHERE categories IS NULL OR categories = ''
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [parseInt(limit)]
      );

      res.status(200).json({
        success: true,
        count: posts.length,
        posts: posts
      });

    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching posts' 
      });
    }
  }

  else if (req.method === 'POST') {
    // POST /api/classify-posts - Bulk update post categories
    try {
      const { classifications } = req.body;

      if (!classifications || !Array.isArray(classifications)) {
        return res.status(400).json({
          success: false,
          message: 'classifications array is required'
        });
      }

      if (classifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'classifications array cannot be empty'
        });
      }

      if (classifications.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 100 classifications allowed per request'
        });
      }

      // Validate each classification
      const errors = [];
      classifications.forEach((item, index) => {
        if (!item.postId || !item.category) {
          errors.push(`Item ${index}: postId and category are required`);
        }
        if (item.category && !VALID_CATEGORIES.includes(item.category)) {
          errors.push(`Item ${index}: Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
        }
      });

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors
        });
      }

      const conn = await promisePool.getConnection();
      await conn.beginTransaction();

      try {
        let updatedCount = 0;
        const results = [];

        for (const { postId, category } of classifications) {
          const [result] = await conn.execute(
            'UPDATE posts SET categories = ? WHERE _id = ?',
            [category, postId]
          );
          
          if (result.affectedRows > 0) {
            updatedCount++;
            results.push({ postId, category, success: true });
          } else {
            results.push({ postId, category, success: false, error: 'Post not found' });
          }
        }

        await conn.commit();

        res.status(200).json({
          success: true,
          message: `Successfully updated ${updatedCount} out of ${classifications.length} posts`,
          updatedCount,
          totalCount: classifications.length,
          results: results
        });

      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }

    } catch (error) {
      console.error('Error updating classifications:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error updating classifications' 
      });
    }
  }

  else {
    res.status(405).json({ 
      success: false, 
      message: 'Method Not Allowed' 
    });
  }
};

module.exports = handler;
