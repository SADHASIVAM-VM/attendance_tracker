import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as userCtrl from '../controllers/userController.js';
import * as worksiteCtrl from '../controllers/worksiteController.js';
import * as assignmentCtrl from '../controllers/assignmentController.js';
import * as attendanceCtrl from '../controllers/attendanceController.js';
import * as regCtrl from '../controllers/regularizationController.js';
import * as leaveCtrl from '../controllers/leaveController.js';
import * as reportCtrl from '../controllers/reportController.js';
import * as flagCtrl from '../controllers/attendanceFlagController.js';
import * as expenseCtrl from '../controllers/expenseController.js';
import * as orgCtrl from '../controllers/organizationController.js';
import * as supervisorCtrl from '../controllers/supervisorAttendanceController.js';
import { getPhotoBuffer, verifyStorageToken } from '../services/storage.js';

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();

// =======================
// Authentication
// =======================
router.post('/auth/login', authCtrl.login);
router.post('/auth/logout', authenticate, authCtrl.logout);
router.get('/auth/me', authenticate, authCtrl.getMe);

// =======================
// Users (Super Admin, Admin)
// =======================
router.get('/users', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), userCtrl.getUsers);
router.post('/users', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.createUser);
router.get('/users/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.getUserById);
router.patch('/users/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.updateUser);
router.put('/users/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.updateUser);
router.post('/users/:id/deactivate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.deactivateUser);

// =======================
// Worksites (Super Admin, Admin)
// =======================
router.get('/worksites', authenticate, worksiteCtrl.getWorksites);
router.post('/worksites', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), worksiteCtrl.createWorksite);
router.post('/worksites/extract-coordinates', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), worksiteCtrl.extractCoordinates);
router.get('/worksites/:id', authenticate, worksiteCtrl.getWorksiteById);
router.patch('/worksites/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), worksiteCtrl.updateWorksite);
router.put('/worksites/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), worksiteCtrl.updateWorksite);
router.post('/worksites/:id/deactivate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), worksiteCtrl.deactivateWorksite);

// =======================
// Organization Settings (Admin policy, supervisor bypass & auto-approve)
// =======================
router.get('/organizations/settings', authenticate, orgCtrl.getOrgSettings);
router.patch('/organizations/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), orgCtrl.updateOrgSettings);
router.put('/organizations/settings', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), orgCtrl.updateOrgSettings);

// =======================
// Daily Assignments
// =======================
router.get('/assignments', authenticate, assignmentCtrl.getAssignments);
router.post('/assignments', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.createAssignment);
router.get('/assignments/:id', authenticate, assignmentCtrl.getAssignmentById);
router.put('/assignments/:id/workers', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.updateAssignmentWorkers);
router.post('/assignments/:id/publish', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.publishAssignment);
router.post('/assignments/:id/cancel', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.cancelAssignment);
router.get('/workers/me/assignments', authenticate, assignmentCtrl.getWorkerMyAssignments);

// =======================
// Attendance & Clock-In
// =======================
router.post('/attendance/photo-upload-auth', authenticate, attendanceCtrl.requestPhotoUploadAuth);
router.post('/attendance/upload-photo', upload.single('photo'), attendanceCtrl.handlePhotoUpload);
router.post('/attendance/clock-in', authenticate, attendanceCtrl.clockIn);
router.post('/attendance/clock-out', authenticate, attendanceCtrl.clockOut);
router.post('/attendance/:id/clock-out', authenticate, attendanceCtrl.clockOut);
router.post('/attendance/sessions/:id/clock-out', authenticate, attendanceCtrl.clockOut);
router.get('/attendance/me', authenticate, attendanceCtrl.getWorkerMyAttendance);
router.get('/attendance/pending-approvals', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.getPendingApprovals);
router.get('/attendance/supervisor-roster', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.getSupervisorTeamRoster);
router.post('/attendance/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.approveAttendance);
router.post('/attendance/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.rejectAttendance);
router.post('/attendance/:id/transfer', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.transferSupervisor);
router.get('/attendance/missing-clock-ins', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.getMissingClockIns);
router.post('/attendance/missing-clock-ins/:id/flag', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.applyAttendanceFlag);

// =======================
// Supervisor Attendance & Location Tracking
// =======================
router.get('/attendance/supervisor/assigned-locations', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorCtrl.getAssignedLocations);
router.get('/attendance/supervisor/active-session', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorCtrl.getActiveSession);
router.post('/attendance/supervisor/location-switch', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorCtrl.switchLocation);
router.post('/attendance/supervisor/clock-in', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorCtrl.supervisorClockIn);
router.post('/attendance/supervisor/clock-out', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorCtrl.supervisorClockOut);
router.get('/reports/supervisor-attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), supervisorCtrl.getSupervisorAttendanceReport);

// =======================
// Attendance Regularization
// =======================
router.post('/attendance/:id/regularization', authenticate, regCtrl.requestRegularization);
router.get('/regularization/pending', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.getPendingRegularizations);
router.post('/regularization/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.approveRegularization);
router.post('/regularization/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.rejectRegularization);

// =======================
// Leave Management
// =======================
router.get('/leave/types', authenticate, leaveCtrl.getLeaveTypes);
router.post('/leave/requests', authenticate, leaveCtrl.createLeaveRequest);
router.get('/leave/requests/me', authenticate, leaveCtrl.getMyLeaveRequests);
router.get('/leave/requests/pending', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.getPendingLeaveRequests);
router.post('/leave/requests/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.approveLeaveRequest);
router.post('/leave/requests/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.rejectLeaveRequest);
router.post('/leave/requests/:id/cancel', authenticate, leaveCtrl.cancelLeaveRequest);

// =======================
// Site Expenses (Spend Ledger)
// =======================
router.get('/expenses', authenticate, expenseCtrl.getExpenses);
router.post('/expenses', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.createExpense);
router.get('/expenses/:id', authenticate, expenseCtrl.getExpenseById);
router.put('/expenses/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.updateExpense);
router.patch('/expenses/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.updateExpense);
router.delete('/expenses/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.deleteExpense);

// =======================
// Reports & Exports
// =======================
router.get('/reports/attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reportCtrl.getAttendanceReport);
router.get('/reports/attendance/export', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reportCtrl.exportAttendanceCsv);

// =======================
// Notifications & Audit
// =======================
router.get('/notifications', authenticate, reportCtrl.getNotifications);
router.post('/notifications/:id/read', authenticate, reportCtrl.markNotificationRead);
router.get('/audit-logs', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reportCtrl.getAuditLogs);

// =======================
// Private Storage Download Stream
// =======================
router.get('/storage/file', async (req, res): Promise<any> => {
  const token = req.query.token as string;
  if (!token) {
    return res.status(401).json({ error: 'TOKEN_REQUIRED' });
  }

  const payload = verifyStorageToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'LINK_EXPIRED_OR_INVALID', message: 'Signed file view link has expired' });
  }

  const buffer = await getPhotoBuffer(payload.photoObjectKey);
  if (!buffer) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Photo file not found in storage' });
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.send(buffer);
});

export default router;
