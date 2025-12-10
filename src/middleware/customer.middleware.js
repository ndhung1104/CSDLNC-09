export function injectCustomer(req, res, next) {
  res.locals.customerUser = req.session?.customer || null;
  next();
}

export function requireCustomer(req, res, next) {
  if (req.session?.customer) return next();
  const redirectTo = encodeURIComponent(req.originalUrl || '/guest/customer/dashboard');
  return res.redirect(`/guest/customer/login?redirect=${redirectTo}`);
}
