const express = require('express');
const {
  getCustomerDashboardData,
  getCustomerAppointmentsData,
  getCustomerNewAppointmentData,
  getCustomerPetsData,
  getCustomerReceiptsData,
} = require('../services/demoData');

const router = express.Router();

router.get('/', (_req, res) => {
  res.render('customer/home', {
    layout: 'layout-customer',
    title: 'Home',
    user: null,
  });
});

router.get('/login', (_req, res) => {
  res.render('customer/login', {
    layout: 'layout-customer',
    title: 'Login',
    user: null,
  });
});

router.get('/dashboard', (_req, res) => {
  const data = getCustomerDashboardData();
  res.render('customer/dashboard', {
    layout: 'layout-customer',
    title: 'Dashboard',
    ...data,
  });
});

router.get('/appointments', (_req, res) => {
  const data = getCustomerAppointmentsData();
  res.render('customer/appointments', {
    layout: 'layout-customer',
    title: 'Appointments',
    ...data,
  });
});

router.get('/appointments/new', (_req, res) => {
  const data = getCustomerNewAppointmentData();
  res.render('customer/appointment-new', {
    layout: 'layout-customer',
    title: 'New Appointment',
    ...data,
  });
});

router.get('/pets', (_req, res) => {
  const data = getCustomerPetsData();
  res.render('customer/pets', {
    layout: 'layout-customer',
    title: 'My Pets',
    ...data,
  });
});

router.get('/receipts', (_req, res) => {
  const data = getCustomerReceiptsData();
  res.render('customer/receipts', {
    layout: 'layout-customer',
    title: 'Receipts',
    ...data,
  });
});

module.exports = router;
