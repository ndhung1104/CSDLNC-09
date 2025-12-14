import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as productModel from '../models/product.model.js';
import * as customerModel from '../models/customer.model.js';

const router = Router();

// List products
router.get('/', requireAnyEmployee(), async (req, res) => {
    const { search = '', page = 1 } = req.query;
    const emp = req.session.employee;
    try {
        const { products, total, limit } = await productModel.getAll({ search, branchId: emp.branchId, page: parseInt(page) });
        const totalPages = Math.ceil(total / limit);
        res.render('products/list', { title: 'Sản phẩm', products, search, page: parseInt(page), totalPages, error: null, employee: emp });
    } catch (err) {
        res.render('products/list', { title: 'Sản phẩm', products: [], search: '', page: 1, totalPages: 0, error: err.message, employee: emp });
    }
});

// View product detail
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const product = await productModel.getById(req.params.id);
        if (!product) return res.redirect('/products');
        res.render('products/detail', { title: product.name, product, error: null, employee: req.session.employee });
    } catch (err) {
        res.redirect('/products');
    }
});

// Purchase product form - with customer dropdown
router.get('/:id/purchase', requireAnyEmployee(), async (req, res) => {
    try {
        const product = await productModel.getById(req.params.id);
        if (!product) return res.redirect('/products');

        // Render purchase page without pre-loading customers (use AJAX Autocomplete)
        res.render('products/purchase', {
            title: `Mua ${product.name}`,
            product,
            customerId: req.query.customerId || '',
            error: null,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.redirect('/products');
    }
});

// Retail purchase - Use Case 4
router.post('/:id/purchase', requireAnyEmployee(), async (req, res) => {
    const { customerId, quantity } = req.body;
    const emp = req.session.employee;
    try {
        const receiptId = await productModel.purchase({
            productId: req.params.id,
            quantity: parseInt(quantity),
            customerId,
            branchId: emp.branchId,
            employeeId: emp.id
        });
        res.redirect(`/receipts/${receiptId}`);
    } catch (err) {
        console.error(err);
        const product = await productModel.getById(req.params.id);
        res.render('products/purchase', {
            title: `Mua ${product?.name}`,
            product,
            customerId,
            error: err.message,
            employee: emp
        });
    }
});

export default router;
