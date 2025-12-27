import { Router } from 'express';
import { getManagementCustomersData } from '../services/demoData.service.js';
import { requireAnyEmployee } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/customers', (_req, res) => {
  const data = getManagementCustomersData();
  res.render('management/customers', {
    title: 'Customers',
    activePage: 'customers',
    ...data,
  });
});

router.get('/appointments', requireAnyEmployee(), (_req, res) => {
  res.redirect('/appointments');
});

export default router;
