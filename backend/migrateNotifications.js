const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const Session = require('./models/Session');
require('dotenv').config();

const fixExistingNotifications = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB successfully.');

    // 1. Find all "completion_request" notifications
    const notificationsToFix = await Notification.find({
      type: 'completion_request'
    });

    console.log(`Found ${notificationsToFix.length} completion request notifications.`);

    let fixedCount = 0;
    for (const notif of notificationsToFix) {
      // Re-initialize fields to ensure they are set
      notif.actionRequired = true;
      notif.actionType = 'confirm_completion';
      
      // If it doesn't have actionData, try to build it from relatedId
      if (!notif.actionData && notif.relatedId) {
        const session = await Session.findById(notif.relatedId);
        if (session) {
          notif.actionData = {
            sessionId: session._id,
            mentorId: session.mentorId,
            skill: 'Session'
          };
        }
      }

      // If it's already read, mark as accepted, otherwise pending
      if (!notif.status) {
        notif.status = notif.read ? 'accepted' : 'pending';
      }

      await notif.save();
      fixedCount++;
      console.log(`Fixed notification: ${notif._id} (Status: ${notif.status})`);
    }

    console.log(`\nSuccess: ${fixedCount} notifications fixed.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error.message);
    process.exit(1);
  }
};

fixExistingNotifications();
