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
import * as supervisorQueueCtrl from '../controllers/supervisorQueueController.js';
import * as adminExCtrl from '../controllers/adminExceptionController.js';
import * as overtimeCtrl from '../controllers/overtimeController.js';
import * as exportCtrl from '../controllers/exportController.js';
import * as payrollCtrl from '../controllers/payrollController.js';
import * as adminCorrectionCtrl from '../controllers/adminCorrectionController.js';
import * as supervisorOverrideCtrl from '../controllers/supervisorOverrideController.js';
import * as delegationCtrl from '../controllers/delegationController.js';
import * as transferCtrl from '../controllers/workerTransferController.js';
import * as adminDashboardCtrl from '../controllers/adminDashboardController.js';
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
// Users & Roles (Admin, Supervisor)
// =======================
router.get('/roles', authenticate, userCtrl.getRoles);
router.get('/users', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), userCtrl.getUsers);
router.post('/users', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.createUser);
router.get('/users/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.getUserById);
router.patch('/users/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.updateUser);
router.put('/users/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.updateUser);
router.post('/users/:id/deactivate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), userCtrl.deactivateUser);

// =======================
// Worksites (Super Admin, Admin)
// =======================
router.get('/worksites/next-code', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), worksiteCtrl.getNextWorksiteCode);
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
router.get('/assignments/worker-allocations', authenticate, assignmentCtrl.getWorkerAllocations);
router.get('/assignments', authenticate, assignmentCtrl.getAssignments);
router.post('/assignments', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.createAssignment);
router.get('/assignments/:id', authenticate, assignmentCtrl.getAssignmentById);
router.put('/assignments/:id/workers', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.updateAssignmentWorkers);
router.post('/assignments/:id/publish', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.publishAssignment);
router.post('/assignments/:id/cancel', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.cancelAssignment);
router.post('/assignments/:id/complete', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), assignmentCtrl.completeAssignment);
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
router.get('/attendance/admin/daily', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), attendanceCtrl.getAdminDailyAttendance);
router.get('/attendance/supervisor/history-range', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.getSupervisorAttendanceHistoryRange);
router.get('/attendance/supervisor/history', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.getSupervisorAttendanceHistoryRange);
router.post('/attendance/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.approveAttendance);
router.post('/attendance/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.rejectAttendance);
router.get('/attendance/:id/history', authenticate, attendanceCtrl.getAttendanceAuditTrail);
router.get('/attendance/sessions/:id/audit-trail', authenticate, attendanceCtrl.getAttendanceAuditTrail);
router.post('/attendance/:id/transfer', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.transferSupervisor);
router.post('/attendance/:id/supervisor-clock-out', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), attendanceCtrl.supervisorClockOutWorker);
router.get('/attendance/missing-clock-ins', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.getMissingClockIns);
router.get('/attendance/exceptions/summary', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.getAttendanceExceptionsSummary);
router.post('/attendance/missing-clock-ins/:id/flag', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.applyAttendanceFlag);
router.post('/attendance/missing-clock-ins/:id/resolve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.applyAttendanceFlag);
router.post('/attendance/missing-clock-ins/create-flag', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.createMissingAttendanceFlag);
router.post('/attendance/missing-clock-ins/flag-worker', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), flagCtrl.createMissingAttendanceFlag);

// Supervisor Attendance Overrides & Monthly Summary
router.post('/attendance/supervisor/override', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorOverrideCtrl.applySupervisorAttendanceOverride);
router.get('/attendance/supervisor/overrides', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorOverrideCtrl.getSupervisorOverrides);
router.get('/attendance/supervisor/summary', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorOverrideCtrl.getSupervisorAttendanceSummary);

// =======================
// Supervisor Approval Queues (Phase 2 Centralized Dashboard)
// =======================
router.get('/supervisor/queues', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorQueueCtrl.getSupervisorQueues);
router.post('/supervisor/queues/exceptions/:id/resolve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorQueueCtrl.resolveException);
router.post('/supervisor/queues/:itemType/:id/escalate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorQueueCtrl.manualEscalateRequest);
router.post('/supervisor/queues/:itemType/:id/clarification', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), supervisorQueueCtrl.requestClarification);

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
router.post('/attendance/regularization', authenticate, regCtrl.requestRegularization);
router.post('/attendance/:id/regularization', authenticate, regCtrl.requestRegularization);
router.get('/regularization/pending', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.getPendingRegularizations);
router.get('/regularization/requests', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.getSupervisorRegularizationRequests);
router.post('/regularization/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.approveRegularization);
router.post('/regularization/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), regCtrl.rejectRegularization);
router.post('/regularization/:id/cancel', authenticate, regCtrl.cancelRegularization);

// =======================
// Leave Management
// =======================
router.get('/leave/types', authenticate, leaveCtrl.getLeaveTypes);
router.post('/leave/requests', authenticate, leaveCtrl.createLeaveRequest);
router.get('/leave/requests/me', authenticate, leaveCtrl.getMyLeaveRequests);
router.get('/leave/requests/team', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.getTeamLeaveRequests);
router.get('/leave/requests/pending', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.getPendingLeaveRequests);
router.post('/leave/requests/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.approveLeaveRequest);
router.post('/leave/requests/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.rejectLeaveRequest);
router.post('/leave/requests/:id/revoke', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), leaveCtrl.revokeLeaveRequest);
router.post('/leave/requests/:id/cancel', authenticate, leaveCtrl.cancelLeaveRequest);

// =======================
// Site Expenses (Spend Ledger & Approval)
// =======================
router.get('/expenses', authenticate, expenseCtrl.getExpenses);
router.post('/expenses', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.createExpense);
router.get('/expenses/:id', authenticate, expenseCtrl.getExpenseById);
router.put('/expenses/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.updateExpense);
router.patch('/expenses/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.updateExpense);
router.delete('/expenses/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.deleteExpense);
router.post('/expenses/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.approveExpense);
router.post('/expenses/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), expenseCtrl.rejectExpense);

// =======================
// Overtime (Phase 3 Engine & Review)
// =======================
router.get('/attendance/me/overtime-summary', authenticate, overtimeCtrl.getWorkerOvertimeSummary);
router.get('/overtime/pending', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), overtimeCtrl.getPendingOvertimeReviews);
router.post('/overtime/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), overtimeCtrl.approveOvertime);
router.post('/overtime/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), overtimeCtrl.rejectOvertime);

// =======================
// Reports & Excel Exports (Phase 3)
// =======================
router.get('/reports/attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reportCtrl.getAttendanceReport);
router.get('/reports/attendance/export', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reportCtrl.exportAttendanceCsv);
router.get('/reports/attendance-overtime', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), reportCtrl.getAttendanceOvertimeReport);
router.get('/reports/expenses-summary', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), reportCtrl.getExpensesSummaryReport);

router.get('/exports/attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), exportCtrl.exportDetailedAttendanceXlsx);
router.get('/exports/worker-summaries', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), exportCtrl.exportWorkerSummariesXlsx);
router.get('/exports/overtime', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), exportCtrl.exportOvertimeXlsx);
router.get('/exports/site-attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), exportCtrl.exportSiteAttendanceXlsx);
router.get('/exports/expenses', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), exportCtrl.exportExpensesXlsx);
router.get('/exports/payroll/:periodId', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), exportCtrl.exportPayrollReconciliationXlsx);

// =======================
// Payroll Reconciliation Workflow (Phase 3)
// =======================
router.get('/payroll/periods', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), payrollCtrl.getPayrollPeriods);
router.post('/payroll/periods', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), payrollCtrl.createPayrollPeriod);
router.get('/payroll/periods/:id/reconciliation', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), payrollCtrl.getPayrollReconciliation);
router.post('/payroll/periods/:id/adjust', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), payrollCtrl.createPayrollAdjustment);
router.post('/payroll/periods/:id/lock', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), payrollCtrl.lockPayrollPeriod);
router.post('/payroll/periods/:id/finalize', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), payrollCtrl.finalizePayrollPeriod);

// =======================
// Notifications & Audit
// =======================
router.get('/notifications', authenticate, reportCtrl.getNotifications);
router.post('/notifications/:id/read', authenticate, reportCtrl.markNotificationRead);
router.post('/notifications/read-all', authenticate, reportCtrl.markAllNotificationsRead);
router.get('/audit-logs', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), reportCtrl.getAuditLogs);

// =======================
// Admin Dashboard Overview & Real-Time Stats
// =======================
router.get('/admin/dashboard/overview', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminDashboardCtrl.getAdminDashboardOverview);
router.get('/admin/dashboard-stats', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminDashboardCtrl.getAdminDashboardOverview);

// =======================
// Admin Exceptions & Oversight Dashboard (Phase 2)
// =======================
router.get('/admin/exceptions/summary', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminExCtrl.getAdminExceptionSummary);
router.get('/admin/exceptions', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminExCtrl.getAdminExceptionsList);
router.get('/admin/exceptions/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminExCtrl.getAdminExceptionDetail);
router.post('/admin/exceptions/:id/reassign', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminExCtrl.reassignException);
router.post('/admin/attendance/:id/override', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminExCtrl.administrativeAttendanceOverride);
router.post('/admin/escalation/run', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminExCtrl.triggerEscalationRun);

// =======================
// Admin Attendance Control Center & Corrections
// =======================
router.get('/admin/corrections/summary', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.getAdminControlSummary);
router.get('/admin/corrections', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.getAdminCorrectionRequests);
router.get('/admin/corrections/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.getAdminCorrectionDetail);
router.post('/admin/corrections/:id/approve', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.approveAdminCorrection);
router.post('/admin/corrections/:id/reject', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.rejectAdminCorrection);
router.post('/admin/corrections/:id/request-info', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.requestInfoAdminCorrection);
router.post('/admin/corrections/create-missing-attendance', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.createAdminMissingAttendanceCorrection);
router.get('/admin/overdue-approvals', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.getAdminOverdueApprovals);
router.post('/admin/overdue-approvals/:id/remind', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.sendOverdueReminder);
router.post('/admin/overdue-approvals/:id/escalate', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), adminCorrectionCtrl.escalateOverdueApproval);

// =======================
// Supervisor Availability, Delegation & Admin Reassignment
// =======================
router.get('/admin/delegations', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), delegationCtrl.getAdminDelegations);
router.post('/admin/reassignments', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), delegationCtrl.createAdminReassignment);
router.post('/admin/delegations/sync', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), delegationCtrl.syncDelegations);
router.get('/supervisor/delegated-scope', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'), delegationCtrl.getSupervisorDelegatedScope);

// =======================
// Worker Worksite Transfer Management (Future-dated, Concurrency Protected)
// =======================
router.post('/worker-transfers', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.scheduleTransfer);
router.get('/worker-transfers', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.listTransfers);
router.get('/worker-transfers/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.getTransferById);
router.patch('/worker-transfers/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.updateTransfer);
router.post('/worker-transfers/:id/cancel', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.cancelTransfer);
router.post('/worker-transfers/reconcile', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.reconcileTransfers);
router.get('/worker-transfers/workers/:workerId/history', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.getWorkerHistory);
router.get('/worker-transfers/workers/:workerId/scheduled', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), transferCtrl.getWorkerScheduledTransfer);

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
