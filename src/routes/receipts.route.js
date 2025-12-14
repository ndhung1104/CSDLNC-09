import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as receiptModel from '../models/receipt.model.js';
import * as customerModel from '../models/customer.model.js';

const router = Router();

// List receipts
router.get('/', requireAnyEmployee(), async (req, res) => {
    const emp = req.session.employee;
    const { status, page = 1 } = req.query;
    try {
        // Show all receipts (not filtered by branch for easier viewing)
        const { receipts, total, limit } = await receiptModel.getAll({ status, page: parseInt(page) });
        const totalPages = Math.ceil(total / limit);
        res.render('receipts/list', { title: 'Hóa đơn', receipts, status, page: parseInt(page), totalPages, error: null, employee: emp });
    } catch (err) {
        console.error(err);
        res.render('receipts/list', { title: 'Hóa đơn', receipts: [], status: '', page: 1, totalPages: 0, error: err.message, employee: emp });
    }
});

// Create receipt form - with customer dropdown
router.get('/create', requireAnyEmployee(), async (req, res) => {
    // Render create page without pre-loading customers (use AJAX Autocomplete)
    res.render('receipts/create', {
        title: 'Tạo hóa đơn',
        customerId: req.query.customerId || '',
        employee: req.session.employee, error: null
    });
});

// Create draft receipt - Use Case 2
router.post('/create', requireAnyEmployee(), async (req, res) => {
    const { customerId } = req.body;
    const emp = req.session.employee;
    try {
        const id = await receiptModel.createDraft({ customerId, branchId: emp.branchId, employeeId: emp.id });
        res.redirect(`/receipts/${id}`);
    } catch (err) {
        console.error(err);
        res.render('receipts/create', { title: 'Tạo hóa đơn', customerId, error: err.message, employee: emp });
    }
});

// View receipt
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const receipt = await receiptModel.getById(req.params.id);
        if (!receipt) return res.redirect('/receipts');
        res.render('receipts/detail', { title: `Hóa đơn #${receipt.RECEIPT_ID}`, receipt, error: null, employee: req.session.employee });
    } catch (err) {
        res.redirect('/receipts');
    }
});

// Complete receipt - Use Case 2 (payment and loyalty points)
router.post('/:id/complete', requireAnyEmployee(), async (req, res) => {
    try {
        await receiptModel.complete(req.params.id);
        res.redirect(`/receipts/${req.params.id}?success=Thanh+toán+thành+công`);
    } catch (err) {
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

export default router;
