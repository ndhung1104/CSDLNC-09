import { Router } from 'express';
const basePath = '/customer';
const router = Router();

function renderCustomerPage(res, view, options = {}) {
  const layout = 'layouts/layout-customer';
  const merged = { basePath, showManagementLink: true, ...options };
  res.render(view, merged, (err, content) => {
    if (err) return res.status(500).send(err.message);
    res.render(layout, { ...merged, body: content }, (layoutErr, html) => {
      if (layoutErr) return res.status(500).send(layoutErr.message);
      res.send(html);
    });
  });
}

function redirectToGuest(res, path = '') {
  const target = path ? `/guest/customer/${path}` : '/guest/customer/';
  res.redirect(target);
}

router.get('/', (_req, res) => {
  redirectToGuest(res);
});

router.get('/login', (_req, res) => {
  redirectToGuest(res, 'login');
});

router.get('/dashboard', (_req, res) => {
  redirectToGuest(res, 'dashboard');
});

router.get('/appointments', (_req, res) => {
  redirectToGuest(res, 'appointments');
});

router.get('/appointments/new', (_req, res) => {
  redirectToGuest(res, 'appointments/new');
});

router.get('/pets', (_req, res) => {
  redirectToGuest(res, 'pets');
});

router.get('/receipts', (_req, res) => {
  redirectToGuest(res, 'receipts');
});

export default router;
