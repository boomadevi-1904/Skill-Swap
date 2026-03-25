const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Session = require('../models/Session');
const Skill = require('../models/Skill');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const { createNotification } = require('../utils/notificationHelper');

const router = express.Router();
const POINTS_PER_SESSION = 10;

// My sessions (as learner or mentor)
router.get('/my', auth, async (req, res) => {
  try {
    const asLearner = await Session.find({ learnerId: req.user._id })
      .populate('mentorId', 'name email contact')
      .populate('skillId', 'title category')
      .sort({ createdAt: -1 });
    const asMentor = await Session.find({ mentorId: req.user._id })
      .populate('learnerId', 'name email contact')
      .populate('skillId', 'title category')
      .sort({ createdAt: -1 });
    res.json({ asLearner, asMentor });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Request session (learner)
router.post(
  '/',
  auth,
  [
    body('skillId').isMongoId().withMessage('Valid skill ID required'),
    body('date').isISO8601().withMessage('Valid date required'),
    body('timeSlot').trim().notEmpty().withMessage('Time slot required'),
    body('teachingMode').isIn(['in-person', 'online', 'flexible']).withMessage('Invalid teaching mode'),
  ],
  async (req, res) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Students only' });
      }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const skill = await Skill.findById(req.body.skillId);
      if (!skill) return res.status(404).json({ error: 'Skill not found' });
      if (skill.mentorId.toString() === req.user._id.toString()) {
        return res.status(400).json({ error: 'Cannot request your own skill' });
      }
      const session = new Session({
        learnerId: req.user._id,
        mentorId: skill.mentorId,
        skillId: skill._id,
        date: req.body.date,
        timeSlot: req.body.timeSlot,
        teachingMode: req.body.teachingMode,
        status: 'pending',
      });
      await session.save();
      const populated = await Session.findById(session._id)
        .populate('mentorId', 'name email')
        .populate('skillId', 'title category');

      // Notify mentor about the new request
      await createNotification({
        userId: skill.mentorId,
        title: 'New Session Request',
        message: `${req.user.name} wants to learn "${skill.title}" from you.`,
        type: 'request',
        link: '/sessions',
        relatedId: session._id,
        relatedModel: 'Session',
      });

      res.status(201).json(populated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Update session status (mentor: accept/reschedule/reject)
router.patch('/:id', auth, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { status } = req.body;
    // Note: 'completed' is now handled only via interactive notification confirmation
    if (!['pending', 'accepted', 'rescheduled', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status update via this route' });
    }

    const isMentor = session.mentorId.toString() === req.user._id.toString();

    if (status === 'accepted' || status === 'rescheduled') {
      if (!isMentor) return res.status(403).json({ error: 'Only mentor can accept/reschedule' });
      session.status = status;
      if (req.body.date) session.date = req.body.date;
      if (req.body.timeSlot) session.timeSlot = req.body.timeSlot;
      
      const skill = await Skill.findById(session.skillId);
      const skillTitle = skill ? skill.title : 'session';
      const baseMsg = status === 'accepted'
          ? `Your session request for "${skillTitle}" has been accepted.`
          : `Your session for "${skillTitle}" has been rescheduled.`;
      
      const details = req.body.date || req.body.timeSlot
          ? ` New schedule: ${req.body.date ? new Date(req.body.date).toLocaleDateString() : ''} ${req.body.timeSlot || ''}`.trim()
          : '';

      await createNotification({
        userId: session.learnerId,
        title: status === 'accepted' ? 'Session Accepted' : 'Session Rescheduled',
        message: `${baseMsg}${details ? ' ' + details : ''}`,
        type: status === 'accepted' ? 'success' : 'info',
        link: '/sessions',
        relatedId: session._id,
        relatedModel: 'Session',
      });
    } else if (status === 'rejected') {
      if (!isMentor) return res.status(403).json({ error: 'Only mentor can reject' });
      
      const skill = await Skill.findById(session.skillId);
      const skillTitle = skill ? skill.title : 'session';

      await createNotification({
        userId: session.learnerId,
        title: 'Session Rejected',
        message: `Your session request for "${skillTitle}" has been rejected.`,
        type: 'warning',
        link: '/browse'
      });

      await Session.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Session rejected and removed', _id: req.params.id, status: 'rejected' });
    }

    await session.save();
    const updated = await Session.findById(session._id)
      .populate('mentorId', 'name email points')
      .populate('learnerId', 'name email')
      .populate('skillId', 'title category');
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Request completion (mentor)
router.post('/:id/request-completion', auth, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    const isMentor = session.mentorId.toString() === req.user._id.toString();
    if (!isMentor && req.user.role !== 'admin') return res.status(403).json({ error: 'Only mentor or admin can request completion' });
    
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session is already marked as completed' });
    }

    const skill = await Skill.findById(session.skillId);
    const skillTitle = skill ? skill.title : 'session';
    
    await createNotification({
      userId: session.learnerId,
      title: 'Confirm Completion',
      message: `Confirm completion for session "${skillTitle}"?`,
      type: 'completion_request',
      actionRequired: true,
      actionType: 'confirm_completion',
      actionData: {
        sessionId: session._id,
        skill: skillTitle,
        mentorId: session.mentorId
      },
      link: '/sessions',
      relatedId: session._id,
      relatedModel: 'Session',
    });
    
    res.json({ ok: true, message: 'Completion request sent to learner' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
