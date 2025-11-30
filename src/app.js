const path = require('path');
const express = require('express');
const { engine } = require('express-handlebars');
const customerRoutes = require('./routes/customer');
const managementRoutes = require('./routes/management');

const app = express();
const PORT = process.env.PORT || 54321;

app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    helpers: {
      substring: (str, start, end) =>
        typeof str === 'string' ? str.substring(start, end) : '',
      formatDate: (date) => {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      },
      toLowerCase: (value) =>
        typeof value === 'string' ? value.toLowerCase() : '',
      eq: (a, b) => a === b,
    },
  })
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/customer/dashboard'));
app.use('/customer', customerRoutes);
app.use('/management', managementRoutes);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PETCAREX app running on http://localhost:${PORT}`);
});
