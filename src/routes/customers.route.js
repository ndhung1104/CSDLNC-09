import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as customerModel from '../models/customer.model.js';

const router = Router();

// List customers with search
router.get('/', requireAnyEmployee(), async (req, res) => {
    const { search = '', page = 1, rankId = '' } = req.query;
    try {
        const ranks = await customerModel.getRanks();
        const { customers, total, limit } = await customerModel.getAll({ search, page: parseInt(page), rankId });
        const totalPages = Math.ceil(total / limit);
        res.render('customers/list', {
            title: 'Khách hàng',
            customers, search, page: parseInt(page), totalPages, total, error: null, rankId, ranks,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.render('customers/list', {
            title: 'Khách hàng', customers: [], search: '', page: 1, totalPages: 0, total: 0,
            error: err.message, rankId, ranks: [], employee: req.session.employee
        });
    }
});

// Register form
router.get('/register', requireAnyEmployee(), (req, res) => {
    res.render('customers/register', { title: 'Đăng ký khách hàng', employee: req.session.employee, error: null });
});

// Register customer - Use Case 1
router.post('/register', requireAnyEmployee(), async (req, res) => {
    const { name, phone, email, password, gender, birthdate } = req.body;
    try {
        const id = await customerModel.create({ name, phone, email, password, gender, birthdate });
        res.redirect(`/customers/${id}`);
    } catch (err) {
        console.error(err);
        res.render('customers/register', { title: 'Đăng ký khách hàng', error: err.message, employee: req.session.employee });
    }
});

// View customer detail
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const customer = await customerModel.getById(req.params.id);
        if (!customer) return res.redirect('/customers');
        res.render('customers/detail', { title: customer.CUSTOMER_NAME, customer, employee: req.session.employee });
    } catch (err) {
        console.error(err);
        res.redirect('/customers');
    }
});

export default router;
