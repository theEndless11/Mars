const { promisePool } = require('../utils/db');

// Set CORS headers for all methods
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

module.exports = async function handler(req, res) {
    setCorsHeaders(res);
    
    // Handle pre-flight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { postId, userId } = req.body;

        // Validate required fields
        if (!postId) {
            return res.status(400).json({ error: 'postId is required' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Start a transaction to ensure data consistency
        const connection = await promisePool.getConnection();
        
        try {
            await connection.beginTransaction();

            // First, check if this user has already viewed this post
            const [existingViews] = await connection.execute(
                'SELECT id FROM post_views WHERE post_id = ? AND user_id = ?',
                [postId, userId]
            );

            let isNewView = false;

            if (existingViews.length === 0) {
                // This is a new view, insert it
                await connection.execute(
                    'INSERT INTO post_views (post_id, user_id, viewed_at) VALUES (?, ?, NOW())',
                    [postId, userId]
                );

                // Increment the view count in the posts table
                await connection.execute(
                    'UPDATE posts SET views_count = views_count + 1 WHERE _id = ?',
                    [postId]
                );

                isNewView = true;
            } else {
                // User has already viewed this post, optionally update the timestamp
                await connection.execute(
                    'UPDATE post_views SET viewed_at = NOW() WHERE post_id = ? AND user_id = ?',
                    [postId, userId]
                );
            }

            // Get the updated view count
            const [postData] = await connection.execute(
                'SELECT views_count FROM posts WHERE _id = ?',
                [postId]
            );

            await connection.commit();
            
            const viewCount = postData.length > 0 ? postData[0].views_count : 0;

            return res.status(200).json({
                success: true,
                message: isNewView ? 'View tracked successfully' : 'View timestamp updated',
                viewCount: viewCount,
                isNewView: isNewView
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error tracking view:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
};

// Export helper function for use in other modules
module.exports.getPostViewStats = getPostViewStats;
