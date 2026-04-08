// User Activity Tracking Module
class ActivityTracker {
  constructor(apiBase = 'http://localhost:5000/api') {
    this.apiBase = apiBase;
    this.currentSection = null;
    this.sectionStartTime = null;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  startTracking(section) {
    if (this.currentSection !== section && this.getToken()) {
      if (this.currentSection && this.sectionStartTime) {
        const duration = (Date.now() - this.sectionStartTime) / 1000;
        this.logToServer(this.currentSection, 'exit', duration);
      }
      this.currentSection = section;
      this.sectionStartTime = Date.now();
      this.logToServer(section, 'view', 0);
    }
  }

  logToServer(section, action, duration) {
    fetch(`${this.apiBase}/activity/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify({ section, action, duration })
    }).catch(e => console.warn('Activity log failed:', e));
  }

  async getSummary() {
    try {
      const response = await fetch(`${this.apiBase}/activity/summary`, {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to get activity summary:', error);
      return null;
    }
  }

  async getSuggestions() {
    try {
      const response = await fetch(`${this.apiBase}/activity/suggestions`, {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async updateInterests(topics) {
    try {
      const response = await fetch(`${this.apiBase}/activity/interests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ topics })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to update interests:', error);
      return null;
    }
  }

  async getActivityLog() {
    try {
      const response = await fetch(`${this.apiBase}/activity/log`, {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to get activity log:', error);
      return [];
    }
  }

  stop() {
    if (this.currentSection && this.sectionStartTime) {
      const duration = (Date.now() - this.sectionStartTime) / 1000;
      this.logToServer(this.currentSection, 'exit', duration);
    }
    this.currentSection = null;
    this.sectionStartTime = null;
  }

  reset() {
    this.stop();
  }
}

// Create global instance for easy access
window.activityTracker = new ActivityTracker();
