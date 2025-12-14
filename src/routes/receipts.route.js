import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as receiptModel from '../models/receipt.model.js';
import * as customerModel from '../models/customer.model.js';

const router = Router();

// List receipts with sorting (drafts first by default)
router.get('/', requireAnyEmployee(), async (req, res) => {
    const emp = req.session.employee;
    const { status, page = 1, sort = 'status' } = req.query;
    try {
        const { receipts, total, limit } = await receiptModel.getAll({ status, page: parseInt(page), sort });
        const totalPages = Math.ceil(total / limit);
        res.render('receipts/list', {
            title: 'Hóa đơn',
            receipts,
            status,
            sort,
            page: parseInt(page),
            totalPages,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error(err);
        res.render('receipts/list', {
            title: 'Hóa đơn',
            receipts: [],
            status: '',
            sort: 'status',
            page: 1,
            totalPages: 0,
            error: err.message,
            employee: emp
        });
    }
});

// Create receipt form - with customer dropdown
router.get('/create', requireAnyEmployee(), async (req, res) => {
    res.render('receipts/create', {
        title: 'Tạo hóa đơn',
        customerId: req.query.customerId || '',
        employee: req.session.employee, error: null
    });
});

// Create draft receipt
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

// View receipt detail with products/services for add modal
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const receipt = await receiptModel.getById(req.params.id);
        if (!receipt) return res.redirect('/receipts');

        // Get available items for the add modal
        const products = await receiptModel.getProducts();
        const services = await receiptModel.getServices();
        const vaccines = await receiptModel.getVaccines();

        res.render('receipts/detail', {
            title: `Hóa đơn #${receipt.RECEIPT_ID}`,
            receipt,
            products,
            services,
            vaccines,
            error: req.query.error || null,
            success: req.query.success || null,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.redirect('/receipts');
    }
});

// Add item to receipt
router.post('/:id/items', requireAnyEmployee(), async (req, res) => {
    const { productId, quantity } = req.body;
    try {
        await receiptModel.addItem({
            receiptId: parseInt(req.params.id),
            productId: parseInt(productId),
            quantity: parseInt(quantity) || 1
        });
        res.redirect(`/receipts/${req.params.id}?success=Đã+thêm+sản+phẩm`);
    } catch (err) {
        console.error(err);
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

// Remove item from receipt
router.post('/:id/items/:itemId/delete', requireAnyEmployee(), async (req, res) => {
    try {
        await receiptModel.removeItem({
            receiptId: parseInt(req.params.id),
            itemId: parseInt(req.params.itemId)
        });
        res.redirect(`/receipts/${req.params.id}?success=Đã+xóa+sản+phẩm`);
    } catch (err) {
        console.error(err);
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

// Complete receipt - payment and loyalty points
router.post('/:id/complete', requireAnyEmployee(), async (req, res) => {
    try {
        await receiptModel.complete(req.params.id);
        res.redirect(`/receipts/${req.params.id}?success=Thanh+toán+thành+công`);
    } catch (err) {
        res.redirect(`/receipts/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});

export default router;

