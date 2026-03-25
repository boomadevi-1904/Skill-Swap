const Notification = require('../models/Notification');

/**
 * Reusable utility to create a notification for a user
 * @param {Object} params 
 * @param {string} params.userId - Recipient user ID
 * @param {string} params.title - Notification title
 * @param {string} params.message - Detailed message
 * @param {string} [params.type='info'] - Type of notification
 * @param {string} [params.link] - Redirection link
 * @param {string} [params.relatedId] - Associated object ID
 * @param {string} [params.relatedModel] - Model name of the related object
 * @param {boolean} [params.actionRequired=false] - Whether the notification needs user interaction
 * @param {string} [params.actionType] - Type of interaction (e.g., 'confirm_completion')
 * @param {Object} [params.actionData] - Data needed for the interaction
 */
const createNotification = async ({
  userId,
  title,
  message,
  type = 'info',
  link,
  relatedId,
  relatedModel,
  actionRequired = false,
  actionType,
  actionData
}) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      type,
      link,
      relatedId,
      relatedModel,
      actionRequired,
      actionType,
      actionData,
      read: false,
      status: actionRequired ? 'pending' : undefined
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

module.exports = { createNotification };
