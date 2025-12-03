const path = require('path');
const express = require('express');
const customerRoutes = require('./routes/customer.route');
const managementRoutes = require('./routes/management.route');
const db = require('./utils/db');

const app = express();
const PORT = process.env.PORT || 54321;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Custom render function to handle layouts
const originalRender = express.response.render;
express.response.render = function(view, options = {}, callback) {
  // Determine which layout to use based on view path
  let layout = 'layouts/layout-customer';
  if (view.includes('management')) {
    layout = 'layouts/layout-management';
  }
  
  // Store the original content in a variable that can be accessed in the layout
  options.body = undefined; // will be filled by the layout
  options.currentView = view;
  options.layout = layout;
  
  // Render the view first
  originalRender.call(this, view, options, (err, rendered) => {
    if (err) return callback(err);
    
    // Now render with layout, passing the rendered content
    const layoutOptions = {
      ...options,
      body: rendered
    };
    
    originalRender.call(this, options.layout, layoutOptions, callback);
  });
};

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/customer/dashboard'));
app.use('/customer', customerRoutes);
app.use('/management', managementRoutes);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PETCAREX app running on http://localhost:${PORT}`);
});
