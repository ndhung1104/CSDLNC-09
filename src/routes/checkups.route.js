import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as checkupModel from '../models/checkup.model.js';
import * as petModel from '../models/pet.model.js';
import * as productModel from '../models/product.model.js';

const router = Router();

// List checkups
router.get('/', requireAnyEmployee(), async (req, res) => {
    const emp = req.session.employee;
    const { status, page = 1 } = req.query;
    const vetId = emp.position === 'VET' ? emp.id : null;
    try {
        const result = await checkupModel.getAll({ vetId, status, page: parseInt(page) });
        console.log('=== CHECKUPS DEBUG ===');
        console.log('Result type:', typeof result);
        console.log('Result keys:', Object.keys(result));
        console.log('Checkups type:', typeof result.checkups);
        console.log('Checkups is array:', Array.isArray(result.checkups));
        console.log('Checkups length:', result.checkups?.length);
        console.log('First checkup:', result.checkups?.[0]);
        console.log('=== END DEBUG ===');

        const { checkups, total, limit } = result;
        const totalPages = Math.ceil(total / limit);
        res.render('checkups/list', { title: 'Phiếu khám', checkups, status, page: parseInt(page), totalPages, error: null, employee: emp });
    } catch (err) {
        console.error('CHECKUPS ERROR:', err);
        res.render('checkups/list', { title: 'Phiếu khám', checkups: [], status: '', page: 1, totalPages: 0, error: err.message, employee: emp });
    }
});

// Create checkup form - show pet and vet dropdowns
router.get('/create', requireAnyEmployee(), async (req, res) => {
    const emp = req.session.employee;
    const vets = await checkupModel.getVets(emp.branchId);
    const medicalServices = await checkupModel.getMedicalServices();
    // Render create page without pre-loading pets (use AJAX Autocomplete)
    res.render('checkups/create', {
        title: 'Tạo phiếu khám', vets, medicalServices,
        petId: req.query.petId || '',
        employee: emp, error: null
    });
});

// Create checkup
router.post('/create', requireAnyEmployee(), async (req, res) => {
    const { petId, vetId, medicalServiceId } = req.body;
    const emp = req.session.employee;
    try {
        const id = await checkupModel.create({ petId, vetId, medicalServiceId: medicalServiceId || 1 });
        res.redirect(`/checkups/${id}`);
    } catch (err) {
        console.error(err);
        const vets = await checkupModel.getVets(emp.branchId);
        const medicalServices = await checkupModel.getMedicalServices();
        res.render('checkups/create', { title: 'Tạo phiếu khám', vets, medicalServices, petId, error: err.message, employee: emp });
    }
});

// View/Edit checkup
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const checkup = await checkupModel.getById(req.params.id);
        if (!checkup) return res.redirect('/checkups');
        const prescriptionItems = await checkupModel.getPrescriptionItems(req.params.id);
        const { products: medicines } = await productModel.getMedicines({ page: 1, limit: 500 });
        res.render('checkups/detail', { title: `Phiếu khám #${checkup.CHECK_UP_ID}`, checkup, prescriptionItems, medicines, error: req.query.error || null, success: req.query.success || null, employee: req.session.employee });
    } catch (err) {
        res.redirect('/checkups');
    }
});

// Update checkup notes - Use Case 2
router.post('/:id/update', requireAnyEmployee(), async (req, res) => {
    const { symptoms, diagnosis, followUpVisit, status } = req.body;
    try {
        await checkupModel.updateNotes({ checkupId: req.params.id, symptoms, diagnosis, followUpVisit: followUpVisit || null, status });
        res.redirect(`/checkups/${req.params.id}`);
    } catch (err) {
        res.redirect(`/checkups/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});


// Replace prescription items for a checkup
router.post('/:id/prescription', requireRole('VET', 'MGR', 'DIRECTOR'), async (req, res) => {
    try {
        const rawIds = req.body.medicineId || [];
        const rawQtys = req.body.quantity || [];
        const ids = Array.isArray(rawIds) ? rawIds : [rawIds];
        const qtys = Array.isArray(rawQtys) ? rawQtys : [rawQtys];

        const items = ids.map((id, idx) => ({
            productId: parseInt(id),
            quantity: parseInt(qtys[idx] || 1)
        })).filter(item => Number.isFinite(item.productId) && item.productId > 0 && Number.isFinite(item.quantity) && item.quantity > 0);

        await checkupModel.replacePrescriptionItems({
            checkupId: parseInt(req.params.id),
            items
        });

        res.redirect(`/checkups/${req.params.id}?success=Prescription+updated`);
    } catch (err) {
        console.error(err);
        res.redirect(`/checkups/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
});
export default router;
