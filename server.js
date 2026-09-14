import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent storage path
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// In-memory OTP storage
// email -> { otp, expiresAt, resendAvailableAt, attempts, pendingUser }
const pendingOtps = new Map();

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (e) {
    console.error('Error reading users file:', e);
  }
  return [];
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving users file:', e);
  }
}

/* =========================================================================
   SERVER AUTH & EMAIL OTP VERIFICATION APIS
   ========================================================================= */

// 1. Check Manager Account Availability
app.get('/api/auth/check-manager', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  const users = loadUsers();
  const managers = users.filter(u => u.role === 'manager');

  if (!email) {
    return res.json({
      exists: managers.length > 0,
      totalManagers: managers.length
    });
  }

  const manager = managers.find(u => u.email && u.email.toLowerCase() === email);
  if (!manager) {
    const pending = pendingOtps.get(email);
    if (pending) {
      return res.json({
        exists: true,
        emailVerified: false,
        isPendingRegistration: true,
        managerName: pending.pendingUser?.fullName,
        workshopName: pending.pendingUser?.workshopName,
        email
      });
    }

    return res.json({
      exists: false,
      totalManagers: managers.length,
      email
    });
  }

  res.json({
    exists: true,
    emailVerified: manager.emailVerified !== false,
    managerName: manager.fullName,
    workshopName: manager.workshopName,
    email
  });
});

// 2. Generate and Send Registration OTP
app.post('/api/auth/send-otp', (req, res) => {
  const { fullName, workshopName, email, password } = req.body || {};

  if (!fullName || !workshopName || !email || !password) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'All fields (Full Name, Workshop Name, Email, Password) are required.'
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();

  // Check if verified manager already exists
  const existingUser = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (existingUser && existingUser.emailVerified !== false) {
    return res.status(409).json({
      error: 'already_exists',
      message: 'A registered manager account with this email already exists.'
    });
  }

  // Check cooldown if OTP was recently dispatched
  const now = Date.now();
  const existingOtp = pendingOtps.get(cleanEmail);
  if (existingOtp && existingOtp.resendAvailableAt > now) {
    const remainingSeconds = Math.ceil((existingOtp.resendAvailableAt - now) / 1000);
    return res.status(429).json({
      error: 'cooldown_active',
      message: `Please wait ${remainingSeconds} seconds before requesting another verification code.`,
      cooldownRemaining: remainingSeconds
    });
  }

  // Generate secure 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const COOLDOWN_SECONDS = 60;
  const EXPIRY_MINUTES = 10;

  pendingOtps.set(cleanEmail, {
    otp: code,
    expiresAt: now + EXPIRY_MINUTES * 60 * 1000,
    resendAvailableAt: now + COOLDOWN_SECONDS * 1000,
    attempts: 0,
    pendingUser: {
      fullName: fullName.trim(),
      workshopName: workshopName.trim(),
      email: cleanEmail,
      password: password.trim()
    }
  });

  console.log(`[AUTH-EMAIL-SERVICE] 📧 OTP Verification Code for <${cleanEmail}>: [${code}] (Valid for ${EXPIRY_MINUTES} min)`);

  res.json({
    success: true,
    message: 'Verification code generated and sent to email.',
    email: cleanEmail,
    cooldownSeconds: COOLDOWN_SECONDS,
    expiresInSeconds: EXPIRY_MINUTES * 60,
    // Provide previewCode for frictionless sandbox testing
    previewCode: code
  });
});

// 3. Resend OTP with Cooldown Protection
app.post('/api/auth/resend-otp', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'missing_email', message: 'Email is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const record = pendingOtps.get(cleanEmail);

  if (!record) {
    return res.status(404).json({
      error: 'no_pending_registration',
      message: 'No pending registration found for this email. Please submit registration details first.'
    });
  }

  const now = Date.now();
  if (record.resendAvailableAt > now) {
    const remainingSeconds = Math.ceil((record.resendAvailableAt - now) / 1000);
    return res.status(429).json({
      error: 'cooldown_active',
      message: `Resend cooldown active. Please wait ${remainingSeconds} seconds.`,
      cooldownRemaining: remainingSeconds
    });
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  const COOLDOWN_SECONDS = 60;

  record.otp = newCode;
  record.expiresAt = now + 10 * 60 * 1000;
  record.resendAvailableAt = now + COOLDOWN_SECONDS * 1000;
  record.attempts = 0;

  console.log(`[AUTH-EMAIL-SERVICE] 📧 Resent OTP Verification Code for <${cleanEmail}>: [${newCode}]`);

  res.json({
    success: true,
    message: 'A fresh verification code has been dispatched.',
    email: cleanEmail,
    cooldownSeconds: COOLDOWN_SECONDS,
    previewCode: newCode
  });
});

// 4. Verify OTP & Activate Manager Account
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body || {};

  if (!email || !otp) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'Both email and verification code are required.'
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.toString().trim();
  const record = pendingOtps.get(cleanEmail);

  if (!record) {
    return res.status(400).json({
      error: 'invalid_or_expired',
      message: 'Verification code not found or session expired. Please request a new code.'
    });
  }

  if (Date.now() > record.expiresAt) {
    pendingOtps.delete(cleanEmail);
    return res.status(400).json({
      error: 'code_expired',
      message: 'Verification code has expired. Please request a new code.'
    });
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    pendingOtps.delete(cleanEmail);
    return res.status(429).json({
      error: 'too_many_attempts',
      message: 'Too many incorrect attempts. Please initiate registration again.'
    });
  }

  if (record.otp !== cleanOtp) {
    return res.status(400).json({
      error: 'incorrect_code',
      message: 'Incorrect verification code. Please check your email.'
    });
  }

  // OTP is confirmed! Create verified manager profile
  const users = loadUsers();
  const newManager = {
    id: 'usr-mgr-' + Date.now(),
    role: 'manager',
    fullName: record.pendingUser.fullName,
    workshopName: record.pendingUser.workshopName || 'CircuitFix Phone Repair',
    email: cleanEmail,
    password: record.pendingUser.password,
    emailVerified: true,
    verifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  // Remove any stale unverified manager records with this email
  const filteredUsers = users.filter(u => !(u.role === 'manager' && u.email && u.email.toLowerCase() === cleanEmail));
  filteredUsers.push(newManager);
  saveUsers(filteredUsers);

  // Clear pending OTP record
  pendingOtps.delete(cleanEmail);

  console.log(`[AUTH-EMAIL-SERVICE] ✅ Manager Account Verified and Activated: <${cleanEmail}> (${newManager.workshopName})`);

  res.json({
    success: true,
    message: 'Email successfully verified. Manager account is now active.',
    user: newManager
  });
});

// 5. Manager & Worker Login with Verification Restriction
app.post('/api/auth/login', (req, res) => {
  const { email, password, role = 'manager' } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  const users = loadUsers();
  const user = users.find(u => u.role === role && u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    return res.status(404).json({
      error: 'user_not_found',
      message: 'Account not found with this email.'
    });
  }

  if (user.password !== cleanPassword) {
    return res.status(401).json({
      error: 'invalid_password',
      message: 'Incorrect password.'
    });
  }

  // Enforce mandatory verification: Restrict access if manager email is unverified
  if (user.role === 'manager' && user.emailVerified === false) {
    return res.status(403).json({
      error: 'unverified_email',
      message: 'Manager account is pending email verification. Please verify your OTP code to proceed.',
      email: cleanEmail
    });
  }

  res.json({
    success: true,
    user
  });
});

// 6. User Management Sync APIs
app.get('/api/users', (req, res) => {
  res.json(loadUsers());
});

app.post('/api/users/sync', (req, res) => {
  const users = req.body;
  if (Array.isArray(users)) {
    saveUsers(users);
    return res.json({ success: true, count: users.length });
  }
  res.status(400).json({ error: 'invalid_format' });
});

// 7. Technical Support & Feedback APIs
const FEEDBACK_FILE = path.join(__dirname, 'data', 'feedback.json');
function loadFeedback() {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) return [];
    return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}
function saveFeedback(feedbackList) {
  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbackList, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save feedback:', e);
  }
}

app.get('/api/support/feedback', (req, res) => {
  res.json(loadFeedback());
});

app.post('/api/support/feedback', (req, res) => {
  const { type, subject, message, senderName, senderContact, senderRole, workshopName } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message_required', message: 'Message content is required.' });
  }

  const newFeedback = {
    id: 'fb-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    type: type || 'general',
    subject: (subject || '').trim() || 'CircuitFix Support Feedback',
    message: message.trim(),
    senderName: (senderName || 'Anonymous').trim(),
    senderContact: (senderContact || '').trim(),
    senderRole: senderRole || 'user',
    workshopName: (workshopName || '').trim(),
    createdAt: new Date().toISOString(),
    status: 'received'
  };

  const list = loadFeedback();
  list.unshift(newFeedback);
  saveFeedback(list);

  res.json({
    success: true,
    message: 'Feedback received successfully.',
    feedback: newFeedback
  });
});

/* =========================================================================
   STATIC ASSETS & SPA ROUTING
   ========================================================================= */
app.use(express.static(__dirname));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

