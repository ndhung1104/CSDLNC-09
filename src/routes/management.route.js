import { Router } from 'express';
import { getManagementCustomersData } from '../services/demoData.service.js';

const router = Router();

router.get('/customers', (_req, res) => {
  const data = getManagementCustomersData();
  res.render('management/customers', {
    title: 'Customers',
    activePage: 'customers',
    ...data,
  });
});

export default router;
