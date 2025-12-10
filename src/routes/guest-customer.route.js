import { Router } from 'express';
import * as demoData from '../services/demoData.service.js';
import { requireCustomer } from '../middleware/customer.middleware.js';

const {
  getCustomerDashboardData,
  getCustomerAppointmentsData,
  getCustomerNewAppointmentData,
  getCustomerPetsData,
  getCustomerReceiptsData,
} = demoData;

const basePath = '/guest/customer';

const router = Router();

function renderCustomerPage(res, view, options = {}) {
  const layout = 'layouts/layout-customer';
  const merged = { basePath, showManagementLink: false, ...options };
  res.render(view, merged, (err, content) => {
    if (err) return res.status(500).send(err.message);
    res.render(layout, { ...merged, body: content }, (layoutErr, html) => {
      if (layoutErr) return res.status(500).send(layoutErr.message);
      res.send(html);
    });
  });
}

// Redirect base to dashboard for convenience
router.get('/', requireCustomer, (_req, res) => {
  res.redirect(`${basePath}/dashboard`);
});

router.get('/home', (_req, res) => {
  renderCustomerPage(res, 'customer/home', {
    title: 'Home',
    user: null,
  });
});

router.get('/dashboard', requireCustomer, (_req, res) => {
  const data = getCustomerDashboardData();
  renderCustomerPage(res, 'customer/dashboard', {
    title: 'Dashboard',
    ...data,
  });
});

router.get('/appointments', requireCustomer, (_req, res) => {
  const data = getCustomerAppointmentsData();
  renderCustomerPage(res, 'customer/appointments', {
    title: 'Appointments',
    ...data,
  });
});

router.get('/appointments/new', requireCustomer, (_req, res) => {
  const data = getCustomerNewAppointmentData();
  renderCustomerPage(res, 'customer/appointment-new', {
    title: 'New Appointment',
    ...data,
  });
});

router.get('/pets', requireCustomer, (_req, res) => {
  const data = getCustomerPetsData();
  renderCustomerPage(res, 'customer/pets', {
    title: 'My Pets',
    ...data,
  });
});

router.get('/receipts', requireCustomer, (_req, res) => {
  const data = getCustomerReceiptsData();
  renderCustomerPage(res, 'customer/receipts', {
    title: 'Receipts',
    ...data,
  });
});

export default router;
