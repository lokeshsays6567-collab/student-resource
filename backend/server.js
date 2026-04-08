require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Models (required before initializing admin user)
const User = require('./models/User');
const Document = require('./models/Document');
const Chat = require('./models/Chat');
const Feedback = require('./models/Feedback');
const ActivityTracking = require('./models/ActivityTracking');

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/studenthub';

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✓ MongoDB Connected Successfully');
    // Initialize admin user
    initializeAdminUser();
  })
  .catch(err => {
    console.error('✗ MongoDB Connection Error:', err.message);
  });

// Initialize Admin User
const initializeAdminUser = async () => {
  try {
    const adminEmail = 'victuslokesh@gmail.com';
    const adminPassword = 'admin@123';
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      // Update existing admin password
      const hashedPassword = await bcryptjs.hash(adminPassword, 10);
      await User.findByIdAndUpdate(existingAdmin._id, {
        password: hashedPassword,
        role: 'admin'
      });
      console.log('✓ Admin credentials updated: victuslokesh@gmail.com');
    } else {
      // Create new admin user
      const hashedPassword = await bcryptjs.hash(adminPassword, 10);
      const adminUser = new User({
        name: 'System Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'Active'
      });
      await adminUser.save();
      console.log('✓ Admin user created: victuslokesh@gmail.com');
    }
  } catch (error) {
    console.error('Error initializing admin user:', error.message);
  }
};


// Configure Multer
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- NEW ADMIN MIDDLEWARE ---
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Administrators only' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- OFFENSIVE CONTENT DETECTION ---
const OFFENSIVE_WORDS = [
  'badword1', 'badword2', 'badword3', 'badword4', 'badword5',
  'abuse', 'hate', 'discriminat', 'racist', 'sexist',
  'kill', 'murder', 'threat', 'violence', 'harm'
];

const containsOffensiveContent = (text) => {
  const lowerText = text.toLowerCase();
  return OFFENSIVE_WORDS.some(word => lowerText.includes(word));
};

// Generate random invite code
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });
    const hashedPassword = await bcryptjs.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role: role || 'student' });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id, name: newUser.name, role: newUser.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
    res.status(201).json({ token, user: { _id: newUser._id, id: String(newUser._id), name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
    res.json({ token, user: { _id: user._id, id: String(user._id), name: user.name, email: user.email, role: user.role } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Return authenticated user info (used by clients to validate stored tokens)
app.get('/api/auth/me', verifyToken, (req, res) => {
  try {
    res.json({ user: { id: req.user.id, name: req.user.name, role: req.user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- DOCUMENT ROUTES ---
app.post('/api/documents/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { name, subject, docClass, type, description } = req.body;
    if (!name) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Document name required' });
    }
    const absoluteUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const newDoc = new Document({
      name, subject: subject || 'General', class: docClass || 'N/A',
      type: type || 'Notes', description: description || '',
      fileName: req.file.filename, fileSize: req.file.size,
      fileUrl: absoluteUrl,
      uploader: req.user.id, uploaderName: req.user.name,
      uploadedAt: new Date(), downloads: 0
    });
    await newDoc.save();
    res.status(201).json({ message: 'Document uploaded successfully', document: newDoc });
  } catch (error) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/documents', verifyToken, async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 });
    res.json(documents);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/documents/:id/download', async (req, res) => {
  try {
    const document = await Document.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } }, { new: true });
    if (!document) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(__dirname, 'uploads', document.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });
    res.download(filePath, document.name);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Preview endpoint - serves files inline for browser viewing
app.get('/api/documents/:id/preview', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(__dirname, 'uploads', document.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });
    
    // Set appropriate headers for preview
    const ext = path.extname(document.fileName).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/documents/:id', verifyToken, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.uploader.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const filePath = path.join(__dirname, 'uploads', document.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- NEW ADMIN MANAGEMENT ROUTES ---

// Get all users
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Ban/Update User Status
app.patch('/api/admin/users/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body; // e.g., 'Active' or 'Banned'
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ message: 'User status updated', user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Admin Stats
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const docCount = await Document.countDocuments();
    res.json({ users: userCount, docs: docCount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Delete User
app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get all documents (admin view)
app.get('/api/admin/documents', verifyAdmin, async (req, res) => {
  try {
    const documents = await Document.find().sort({ uploadedAt: -1 }).populate('uploader', 'name email');
    res.json(documents);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Delete Document (admin only)
app.delete('/api/admin/documents/:id', verifyAdmin, async (req, res) => {
  try {
    const document = await Document.findByIdAndDelete(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    // Delete file from uploads folder
    const filePath = path.join(__dirname, 'uploads', document.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Add new user (admin only)
app.post('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'student'
    });
    
    await newUser.save();
    
    res.status(201).json({ 
      message: 'User created successfully', 
      user: { _id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- CHAT ROUTES ---
app.get('/api/chats', verifyToken, async (req, res) => {
  try {
    const chats = await Chat.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
    res.json(chats);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/chats', verifyToken, async (req, res) => {
  try {
    const { name, type, password } = req.body;
    const inviteCode = generateInviteCode();
    const newChat = new Chat({ 
      name, 
      type: type || 'private', 
      password, 
      inviteCode,
      createdBy: req.user.id, 
      members: [req.user.id],
      messages: [] 
    });
    await newChat.save();
    res.status(201).json({ chat: newChat });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get invite link for a group
app.get('/api/chats/:chatId/invite', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    if (chat.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only group creator can generate invite' });
    }

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite.html?code=${chat.inviteCode}`;
    res.json({ inviteLink, inviteCode: chat.inviteCode });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get group data from invite code
app.get('/api/chats/invite/:code', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findOne({ inviteCode: req.params.code })
      .populate('createdBy', 'name email');
    
    if (!chat) return res.status(404).json({ error: 'Invalid invite link' });
    
    res.json({
      _id: chat._id,
      name: chat.name,
      type: chat.type,
      createdBy: chat.createdBy,
      messages: chat.messages
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Join group via invite code
app.post('/api/chats/join-invite', verifyToken, async (req, res) => {
  try {
    const { inviteCode, password } = req.body;
    
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    const chat = await Chat.findOne({ inviteCode });
    if (!chat) return res.status(404).json({ error: 'Group not found' });

    // Check if user is already a member
    if (chat.members.includes(req.user.id)) {
      return res.status(400).json({ error: 'You are already a member of this group' });
    }

    // For private groups, verify password
    if (chat.type === 'private') {
      if (!password || password !== chat.password) {
        return res.status(403).json({ error: 'Incorrect password' });
      }
    }

    // Add user to group
    chat.members.push(req.user.id);
    await chat.save();

    res.json({ 
      success: true, 
      message: 'Successfully joined group',
      chatId: chat._id 
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/chats/:chatId', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    // Only creator or admin can delete
    if (chat.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await Chat.findByIdAndDelete(req.params.chatId);
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/chats/:chatId/leave', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    // Cannot leave if you're the creator
    if (chat.createdBy.toString() === req.user.id) {
      return res.status(403).json({ error: 'Group creator cannot leave. Delete the group instead.' });
    }
    
    // Remove user from members array
    chat.members = chat.members.filter(memberId => memberId.toString() !== req.user.id);
    await chat.save();
    
    res.json({ message: 'Successfully left the group' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/chats/:chatId/messages', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ messages: chat.messages || [] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/chats/:chatId/messages', verifyToken, async (req, res) => {
  try {
    const { text, fileName, fileUrl, type } = req.body;
    const chat = await Chat.findByIdAndUpdate(
      req.params.chatId,
      {
        $push: {
          messages: {
            sender: req.user.name,
            text,
            fileName: fileName || null,
            fileUrl: fileUrl || null,
            timestamp: new Date(),
            type: type || 'text'
          }
        }
      },
      { new: true }
    );
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json({ success: true, message: chat.messages[chat.messages.length - 1] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/chats/:chatId/upload-file', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    // Create a full absolute URL that works for all clients
    const protocol = req.protocol === 'http' ? 'http' : 'https';
    const host = req.get('host');
    const absoluteUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    res.json({
      fileName: req.file.originalname,
      fileUrl: absoluteUrl,
      fileSize: req.file.size
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Direct file access route for PDFs and other files
app.get('/api/file/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Security: only allow access to files in uploads directory
    const filePath = path.join(__dirname, 'uploads', filename);
    const normalizedPath = path.normalize(filePath);
    const uploadsDir = path.normalize(path.join(__dirname, 'uploads'));
    
    if (!normalizedPath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- FEEDBACK ROUTES ---
app.post('/api/feedback', verifyToken, async (req, res) => {
  try {
    const { resourceId, resourceType, rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    if (!resourceId) {
      return res.status(400).json({ error: 'Resource ID is required' });
    }

    // Check if user already gave feedback for this resource
    const existingFeedback = await Feedback.findOne({
      userId: req.user.id,
      resourceId: resourceId
    });

    if (existingFeedback) {
      return res.status(400).json({ error: 'You have already provided feedback for this resource' });
    }

    const feedbackType = resourceType && ['Document', 'Group', 'System'].includes(resourceType) ? resourceType : 'Document';
    const newFeedback = new Feedback({
      userId: req.user.id,
      userName: req.user.name,
      resourceId,
      resourceType: feedbackType,
      rating: parseInt(rating),
      feedback: feedback || '',
      createdAt: new Date()
    });
    await newFeedback.save();
    res.status(201).json({ message: 'Feedback submitted successfully', feedback: newFeedback });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all feedbacks for a resource
app.get('/api/feedback/:resourceId', verifyToken, async (req, res) => {
  try {
    const feedbackList = await Feedback.find({ resourceId: req.params.resourceId }).sort({ createdAt: -1 });
    res.json(feedbackList);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Check if user already gave feedback for a resource
app.get('/api/feedback-check/:resourceId', verifyToken, async (req, res) => {
  try {
    const userFeedback = await Feedback.findOne({
      userId: req.user.id,
      resourceId: req.params.resourceId
    });
    res.json({ hasGivenFeedback: !!userFeedback });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Admin: Get all feedbacks
app.get('/api/admin/feedbacks', verifyAdmin, async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Admin: Delete feedback
app.delete('/api/admin/feedbacks/:id', verifyAdmin, async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ===== USER ACTIVITY TRACKING & PERSONALIZED SUGGESTIONS =====

// Log user activity
app.post('/api/activity/log', verifyToken, async (req, res) => {
  try {
    const { section, action, duration, resourceId, metadata } = req.body;
    
    if (!section) {
      return res.status(400).json({ error: 'Section is required' });
    }

    let activity = await ActivityTracking.findOne({ userId: req.user.id });
    
    if (!activity) {
      activity = new ActivityTracking({
        userId: req.user.id,
        activityLog: []
      });
    }

    activity.activityLog.push({
      section,
      action: action || 'view',
      duration: duration || 0,
      resourceId: resourceId || null,
      metadata: metadata || {},
      timestamp: new Date()
    });

    activity.totalTimeSpent += (duration || 0);
    activity.sectionBreakdown[section] = (activity.sectionBreakdown[section] || 0) + (duration || 0);
    activity.lastActivity = new Date();

    const sections = Object.entries(activity.sectionBreakdown)
      .sort(([, a], [, b]) => b - a);
    activity.mostVisitedSection = sections[0] ? sections[0][0] : null;

    await activity.save();
    
    res.status(201).json({ 
      message: 'Activity logged successfully',
      activity: activity 
    });
  } catch (error) {
    console.error('Activity logging error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user activity summary
app.get('/api/activity/summary', verifyToken, async (req, res) => {
  try {
    const activity = await ActivityTracking.findOne({ userId: req.user.id });
    
    if (!activity) {
      return res.json({
        totalTimeSpent: 0,
        sectionBreakdown: {},
        mostVisitedSection: null,
        suggestedResources: []
      });
    }

    res.json({
      totalTimeSpent: activity.totalTimeSpent,
      sectionBreakdown: activity.sectionBreakdown,
      mostVisitedSection: activity.mostVisitedSection,
      suggestedResources: activity.personalizationPreferences.suggestedResources || [],
      interestedTopics: activity.personalizationPreferences.interestedTopics || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get personalized suggestions
app.get('/api/activity/suggestions', verifyToken, async (req, res) => {
  try {
    let activity = await ActivityTracking.findOne({ userId: req.user.id });
    
    if (!activity) {
      return res.json({ suggestions: [] });
    }

    const documents = await Document.find().limit(10);
    const suggestions = [];

    for (const doc of documents) {
      let relevanceScore = 0;

      if (activity.personalizationPreferences.interestedTopics.length > 0) {
        const docTags = doc.tags || [];
        const matchingTopics = activity.personalizationPreferences.interestedTopics
          .filter(topic => docTags.some(tag => tag.toLowerCase().includes(topic.toLowerCase())));
        relevanceScore += matchingTopics.length * 10;
      }

      if (activity.mostVisitedSection === 'documents') {
        relevanceScore += 5;
      }

      if (relevanceScore > 0) {
        suggestions.push({
          resourceId: doc._id,
          resourceType: 'Document',
          title: doc.title,
          description: doc.description,
          relevanceScore
        });
      }
    }

    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topSuggestions = suggestions.slice(0, 5);

    if (!activity.personalizationPreferences) {
      activity.personalizationPreferences = {};
    }
    
    activity.personalizationPreferences.suggestedResources = topSuggestions.map(s => ({
      resourceId: s.resourceId,
      resourceType: s.resourceType,
      title: s.title,
      relevanceScore: s.relevanceScore,
      suggestedAt: new Date()
    }));

    await activity.save();
    
    res.json({ suggestions: topSuggestions });
  } catch (error) {
    console.error('Suggestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user interests
app.post('/api/activity/interests', verifyToken, async (req, res) => {
  try {
    const { topics } = req.body;
    
    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({ error: 'Topics array is required' });
    }

    let activity = await ActivityTracking.findOne({ userId: req.user.id });
    
    if (!activity) {
      activity = new ActivityTracking({
        userId: req.user.id,
        personalizationPreferences: {
          interestedTopics: topics
        }
      });
    } else {
      if (!activity.personalizationPreferences) {
        activity.personalizationPreferences = {};
      }
      activity.personalizationPreferences.interestedTopics = topics;
    }

    await activity.save();
    
    res.json({ 
      message: 'Interests updated successfully',
      interests: activity.personalizationPreferences.interestedTopics 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed activity log
app.get('/api/activity/log', verifyToken, async (req, res) => {
  try {
    const activity = await ActivityTracking.findOne({ userId: req.user.id });
    
    if (!activity) {
      return res.json({ activityLog: [] });
    }

    const activityLog = activity.activityLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
    
    res.json({ activityLog });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO - Save messages and emit to chat room
io.on('connection', (socket) => {
  console.log('✓ Connected:', socket.id);
  
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });
  
  socket.on('send_message', async (data) => {
    try {
      const { chatId, sender, text, fileName, fileUrl, type } = data;
      
      // Save to database
      const chat = await Chat.findByIdAndUpdate(
        chatId,
        {
          $push: {
            messages: {
              sender,
              text,
              fileName: fileName || null,
              fileUrl: fileUrl || null,
              timestamp: new Date(),
              type: type || 'text'
            }
          }
        },
        { new: true }
      );
      
      // Emit to all users in the room
      io.to(chatId).emit('receive_message', {
        chatId,
        sender,
        text,
        fileName,
        fileUrl,
        type: type || 'text',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Message save error:', error);
      socket.emit('error', { message: 'Failed to save message' });
    }
  });
  
  socket.on('disconnect', () => console.log('✗ Disconnected'));
});

// Error Handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

// Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});