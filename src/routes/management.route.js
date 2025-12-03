const express = require('express');
const {
  getManagementDashboardData,
  getManagementCustomersData,
} = require('../services/demoData.service');

const router = express.Router();

router.get('/dashboard', (_req, res) => {
  const data = getManagementDashboardData();
  res.render('management/dashboard', {
    title: 'Dashboard',
    activePage: 'dashboard',
    ...data,
  });
});

router.get('/customers', (_req, res) => {
  const data = getManagementCustomersData();
  res.render('management/customers', {
    title: 'Customers',
    activePage: 'customers',
    ...data,
  });
});

module.exports = router;
