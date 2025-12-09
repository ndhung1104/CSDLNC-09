import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import { injectUser } from './middleware/auth.middleware.js';
import authRoutes from './routes/auth.route.js';
import dashboardRoutes from './routes/dashboard.route.js';
import customersRoutes from './routes/customers.route.js';
import petsRoutes from './routes/pets.route.js';
import checkupsRoutes from './routes/checkups.route.js';
import receiptsRoutes from './routes/receipts.route.js';
import vaccinationRoutes from './routes/vaccination.route.js';
import productsRoutes from './routes/products.route.js';
import reportsRoutes from './routes/reports.route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 54321;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'petcarex-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(injectUser);

app.get('/', (_req, res) => res.redirect('/login'));
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/customers', customersRoutes);
app.use('/pets', petsRoutes);
app.use('/checkups', checkupsRoutes);
app.use('/receipts', receiptsRoutes);
app.use('/vaccination-plans', vaccinationRoutes);
app.use('/products', productsRoutes);
app.use('/reports', reportsRoutes);
app.use('/api', (await import('./routes/api.route.js')).default);

app.use((err, req, res, _next) => {
    console.error(err.stack);
    res.status(500).render('error', { title: 'Error', message: err.message });
});

app.listen(PORT, () => {
    console.log(`🐾 PetCareX running on http://localhost:${PORT}`);
});
