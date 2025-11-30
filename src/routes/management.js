const express = require('express');
const {
  getManagementDashboardData,
  getManagementCustomersData,
} = require('../services/demoData');

const router = express.Router();

router.get('/dashboard', (_req, res) => {
  const data = getManagementDashboardData();
  res.render('management/dashboard', {
    layout: 'layout-management',
    title: 'Dashboard',
    activePage: 'dashboard',
    ...data,
  });
});

router.get('/customers', (_req, res) => {
  const data = getManagementCustomersData();
  res.render('management/customers', {
    layout: 'layout-management',
    title: 'Customers',
    activePage: 'customers',
    ...data,
  });
});

module.exports = router;
