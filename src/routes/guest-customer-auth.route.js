import { Router } from 'express';
import { findByLogin } from '../models/customer.model.js';

const router = Router();
const basePath = '/guest/customer';
const layout = 'layouts/layout-customer';

function renderGuestCustomer(res, view, options = {}) {
  const merged = { basePath, showManagementLink: false, ...options };
  res.render(view, merged, (err, content) => {
    if (err) return res.status(500).send(err.message);
    res.render(layout, { ...merged, body: content }, (layoutErr, html) => {
      if (layoutErr) return res.status(500).send(layoutErr.message);
      res.send(html);
    });
  });
}

router.get('/login', (req, res) => {
  if (req.session.customer) return res.redirect(`${basePath}/dashboard`);
  renderGuestCustomer(res, 'customer/login', {
    title: 'Login',
    email: '',
    error: null,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const customer = await findByLogin(email);
    if (!customer) {
      return renderGuestCustomer(res, 'customer/login', {
        title: 'Login',
        email,
        error: 'Account not found',
      });
    }

    const stored = (customer.password || '').trim();
    if (stored !== (password || '').trim()) {
      return renderGuestCustomer(res, 'customer/login', {
        title: 'Login',
        email,
        error: 'Incorrect password',
      });
    }

    req.session.customer = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      rankId: customer.rankId,
    };

    const redirectUrl = req.query.redirect
      ? decodeURIComponent(req.query.redirect)
      : `${basePath}/dashboard`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Customer login error:', err);
    renderGuestCustomer(res, 'customer/login', {
      title: 'Login',
      email,
      error: 'System error, please try again',
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.customer = null;
  req.session.destroy(() => {
    res.redirect(`${basePath}/login`);
  });
});

export default router;
