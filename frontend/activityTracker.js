import { activityAPI } from './api.js';

class ActivityTracker {
  constructor() {
    this.sessionStart = null;
    this.currentSection = null;
    this.sectionStartTime = null;
    this.isTracking = false;
    this.logInterval = 30000; // Log every 30 seconds
    this.logTimer = null;
  }

  // Initialize activity tracking
  init(section = 'homepage') {
    if (localStorage.getItem('token')) {
      this.startTracking(section);
    }
  }

  // Start tracking for a specific section
  startTracking(section) {
    if (!['homepage', 'documents', 'groups', 'chat', 'profile', 'learning_hub'].includes(section)) {
      console.warn(`Unknown section: ${section}`);
      return;
    }

    if (this.currentSection !== section) {
      if (this.currentSection && this.sectionStartTime) {
        this.logSectionExit(this.currentSection);
      }
      
      this.currentSection = section;
      this.sectionStartTime = Date.now();
      this.isTracking = true;
      
      this.logActivity(section, 'view', 0);
      
      if (!this.logTimer) {
        this.logTimer = setInterval(() => this.periodicLog(), this.logInterval);
      }
    }
  }

  // Log section exit with duration
  logSectionExit(section) {
    if (this.sectionStartTime) {
      const duration = (Date.now() - this.sectionStartTime) / 1000;
      this.logActivity(section, 'exit', duration);
    }
  }

  // Log user activity
  async logActivity(section, action, duration = 0, resourceId = null, metadata = {}) {
    if (!localStorage.getItem('token')) return;

    try {
      await activityAPI.logActivity(section, action, duration, resourceId, metadata);
    } catch (error) {
      console.warn('Failed to log activity:', error);
    }
  }

  // Periodic activity logging
  periodicLog() {
    if (this.currentSection && this.sectionStartTime) {
      const duration = (Date.now() - this.sectionStartTime) / 1000;
      this.logActivity(this.currentSection, 'active', duration);
    }
  }

  // Get activity summary
  async getSummary() {
    try {
      return await activityAPI.getSummary();
    } catch (error) {
      console.error('Failed to get activity summary:', error);
      return null;
    }
  }

  // Get personalized suggestions
  async getSuggestions() {
    try {
      return await activityAPI.getSuggestions();
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  // Update user interests
  async updateInterests(topics) {
    try {
      return await activityAPI.updateInterests(topics);
    } catch (error) {
      console.error('Failed to update interests:', error);
      return null;
    }
  }

  // Get activity log
  async getActivityLog() {
    try {
      return await activityAPI.getActivityLog();
    } catch (error) {
      console.error('Failed to get activity log:', error);
      return [];
    }
  }

  // Stop tracking
  stop() {
    if (this.logTimer) {
      clearInterval(this.logTimer);
      this.logTimer = null;
    }
    if (this.currentSection && this.sectionStartTime) {
      this.logSectionExit(this.currentSection);
    }
    this.isTracking = false;
  }

  // Reset tracker
  reset() {
    this.stop();
    this.sessionStart = null;
    this.currentSection = null;
    this.sectionStartTime = null;
  }
}

// Create and export singleton instance
export const activityTracker = new ActivityTracker();

// Auto-initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    activityTracker.init();
  });
} else {
  activityTracker.init();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  activityTracker.stop();
});
