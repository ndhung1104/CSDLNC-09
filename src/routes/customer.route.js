const express = require('express');
const {
  getCustomerDashboardData,
  getCustomerAppointmentsData,
  getCustomerNewAppointmentData,
  getCustomerPetsData,
  getCustomerReceiptsData,
} = require('../services/demoData.service');

const router = express.Router();

router.get('/', (_req, res) => {
  res.render('customer/home', {
    title: 'Home',
    user: null,
  });
});

router.get('/login', (_req, res) => {
  res.render('customer/login', {
    title: 'Login',
    user: null,
  });
});

router.get('/dashboard', (_req, res) => {
  const data = getCustomerDashboardData();
  res.render('customer/dashboard', {
    title: 'Dashboard',
    ...data,
  });
});

router.get('/appointments', (_req, res) => {
  const data = getCustomerAppointmentsData();
  res.render('customer/appointments', {
    title: 'Appointments',
    ...data,
  });
});

router.get('/appointments/new', (_req, res) => {
  const data = getCustomerNewAppointmentData();
  res.render('customer/appointment-new', {
    title: 'New Appointment',
    ...data,
  });
});

router.get('/pets', (_req, res) => {
  const data = getCustomerPetsData();
  res.render('customer/pets', {
    title: 'My Pets',
    ...data,
  });
});

router.get('/receipts', (_req, res) => {
  const data = getCustomerReceiptsData();
  res.render('customer/receipts', {
    title: 'Receipts',
    ...data,
  });
});

module.exports = router;
