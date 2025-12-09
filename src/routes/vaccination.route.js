import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import * as vaccinationModel from '../models/vaccination.model.js';
import * as petModel from '../models/pet.model.js';

const router = Router();

// List vaccination plans
router.get('/', requireRole('SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const { page = 1 } = req.query;
    try {
        const { plans, total, limit } = await vaccinationModel.getAll({ page: parseInt(page) });
        const totalPages = Math.ceil(total / limit);
        res.render('vaccination/list', { title: 'Gói tiêm phòng', plans, page: parseInt(page), totalPages, error: null, employee: req.session.employee });
    } catch (err) {
        console.error(err);
        res.render('vaccination/list', { title: 'Gói tiêm phòng', plans: [], page: 1, totalPages: 0, error: err.message, employee: req.session.employee });
    }
});

// View plan detail
router.get('/:id', requireRole('SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    try {
        const plan = await vaccinationModel.getById(req.params.id);
        if (!plan) return res.redirect('/vaccination-plans');
        res.render('vaccination/detail', { title: plan.name, plan, error: null, employee: req.session.employee });
    } catch (err) {
        res.redirect('/vaccination-plans');
    }
});

// Purchase vaccination plan form - with pet dropdown
router.get('/:id/purchase', requireRole('SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    try {
        const plan = await vaccinationModel.getById(req.params.id);
        if (!plan) return res.redirect('/vaccination-plans');

        // Render purchase page without pre-loading pets (use AJAX Autocomplete)
        res.render('vaccination/purchase', {
            title: `Mua ${plan.name}`,
            plan,
            petId: req.query.petId || '',
            error: null,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.redirect('/vaccination-plans');
    }
});

// Purchase vaccination plan - Use Case 3
router.post('/:id/purchase', requireRole('SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const { petId } = req.body;
    const emp = req.session.employee;
    try {
        // Get pet to find customer ID
        const pet = await petModel.getById(petId);
        if (!pet) throw new Error('Không tìm thấy thú cưng');

        const receiptId = await vaccinationModel.purchase({
            planId: req.params.id,
            petId,
            customerId: pet.CUSTOMER_ID,
            branchId: emp.branchId,
            employeeId: emp.id,
            paymentMethod: 'Cash'
        });
        res.redirect(`/receipts/${receiptId}`);
    } catch (err) {
        console.error(err);
        console.error(err);
        const plan = await vaccinationModel.getById(req.params.id);
        res.render('vaccination/purchase', {
            title: `Mua ${plan?.name}`,
            plan,
            petId,
            error: err.message,
            employee: emp
        });
    }
});

export default router;
