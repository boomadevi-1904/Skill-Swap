const express = require('express');
const Notification = require('../models/Notification');
const Session = require('../models/Session');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();
const POINTS_PER_SESSION = 10;

// Get my notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Accept completion notification
router.put('/:id/accept', auth, async (req, res) => {
  try {
    console.log(`[ACCEPT] Notification ID: ${req.params.id}`);
    
    const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
    if (!notification) {
      console.log(`[ACCEPT] Notification not found for user: ${req.user._id}`);
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.status !== 'pending') {
      console.log(`[ACCEPT] Action already taken. Status: ${notification.status}`);
      return res.status(400).json({ error: `Action already taken. Current status: ${notification.status}` });
    }

    if (notification.actionType === 'confirm_completion') {
      console.log(`[ACCEPT] ActionData:`, notification.actionData);
      
      let sessionId = notification.actionData?.sessionId;
      let mentorId = notification.actionData?.mentorId;

      // Fallback: If actionData is missing but we have relatedId
      if (!sessionId && notification.relatedId && notification.relatedModel === 'Session') {
        console.log(`[ACCEPT] Fallback: Using relatedId as sessionId`);
        sessionId = notification.relatedId;
        
        // If mentorId is also missing, we need to find the session to get it
        if (!mentorId) {
          const session = await Session.findById(sessionId);
          if (session) {
            mentorId = session.mentorId;
          }
        }
      }
      
      if (!sessionId || !mentorId) {
        console.log(`[ACCEPT] Missing critical IDs (Session: ${sessionId}, Mentor: ${mentorId})`);
        return res.status(400).json({ error: 'Missing session or mentor information in notification' });
      }

      // Update session status atomically if possible
      const session = await Session.findOneAndUpdate(
        { _id: sessionId },
        { status: 'completed' },
        { new: true }
      );

      if (session) {
        // Award points to mentor
        await User.findByIdAndUpdate(mentorId, {
          $inc: { points: POINTS_PER_SESSION }
        });
        console.log(`[ACCEPT] Session ${sessionId} completed. Points awarded to mentor ${mentorId}`);
      } else {
        console.warn(`[ACCEPT] Session ${sessionId} not found.`);
        return res.status(404).json({ error: 'Associated session not found' });
      }
    }

    notification.status = 'accepted';
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    console.log(`[ACCEPT] Success`);
    res.json(notification);
  } catch (e) {
    console.error('[ACCEPT] Error:', e);
    res.status(500).json({ error: e.message || 'Failed to process acceptance.' });
  }
});

// Reject completion notification
router.put('/:id/reject', auth, async (req, res) => {
  try {
    console.log(`Processing REJECT for notification: ${req.params.id} by user: ${req.user._id}`);

    const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({ error: `Action already taken. Current status: ${notification.status}` });
    }

    notification.status = 'rejected';
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json(notification);
  } catch (e) {
    console.error('Error in reject notification:', e);
    res.status(500).json({ error: 'Failed to process rejection.' });
  }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { 
        read: true,
        readAt: new Date()
      },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark all as read
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { 
        read: true,
        readAt: new Date()
      }
    );
    res.json({ message: 'All marked as read' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
