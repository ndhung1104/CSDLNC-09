import express from 'express';
import {
  getManagementDashboardData,
  getManagementCustomersData,
  processYearEnd
} from '../services/management.service.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/dashboard', requireRole('MGR', 'DIRECTOR'), async (req, res) => {
  try {
    // Assuming 'branchId' might come from MGR's session if they are Branch Manager
    // Director sees all? The prompt implies Director sees "System wide", Branch Mgr sees "Branch".
    // Let's check employee role.
    const emp = req.session.employee;
    const branchId = emp.role === 'MGR' ? emp.branchId : null; // Director (DIRECTOR) sees all (null)

    const data = await getManagementDashboardData(branchId);
    res.render('management/dashboard', {
      title: 'Dashboard',
      activePage: 'dashboard',
      employee: emp,
      ...data,
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: err.message });
  }
});

router.get('/customers', requireRole('MGR', 'DIRECTOR'), async (req, res) => {
  try {
    const page = req.query.page || 1;
    const data = await getManagementCustomersData(page);
    res.render('management/customers', {
      title: 'Customers',
      activePage: 'customers',
      employee: req.session.employee,
      ...data,
    });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', message: err.message });
  }
});

router.post('/year-end-process', requireRole('DIRECTOR'), async (req, res) => {
  try {
    const result = await processYearEnd();
    res.json({ success: true, message: 'Year-end processing completed successfully', result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
