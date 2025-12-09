import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import * as petModel from '../models/pet.model.js';

const router = Router();

// List pets
router.get('/', requireRole('RECEP', 'VET', 'MGR', 'DIRECTOR', 'SALES'), async (req, res) => {
    const { search = '', page = 1 } = req.query;
    try {
        const { pets, total, limit } = await petModel.getAll({ search, page: parseInt(page) });
        const totalPages = Math.ceil(total / limit);
        res.render('pets/list', {
            title: 'Thú cưng', pets, search, page: parseInt(page), totalPages, total, error: null,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.render('pets/list', { title: 'Thú cưng', pets: [], search: '', page: 1, totalPages: 0, total: 0, error: err.message, employee: req.session.employee });
    }
});

// Create pet form
router.get('/create', requireRole('RECEP', 'MGR', 'DIRECTOR'), async (req, res) => {
    const breeds = await petModel.getBreeds();
    res.render('pets/create', {
        title: 'Thêm thú cưng', breeds,
        customerId: req.query.customerId || '',
        employee: req.session.employee, error: null
    });
});

// Create pet - Use Case 1
router.post('/create', requireRole('RECEP', 'MGR', 'DIRECTOR'), async (req, res) => {
    const { customerId, breedId, name, gender, healthStatus } = req.body;
    try {
        const customerIdInt = parseInt(customerId);
        const breedIdInt = parseInt(breedId);

        if (isNaN(customerIdInt) || isNaN(breedIdInt)) {
            throw new Error('Vui lòng kiểm tra lại ID khách hàng và giống thú cưng.');
        }

        await petModel.create({
            customerId: customerIdInt,
            breedId: breedIdInt,
            name,
            gender,
            healthStatus
        });
        res.redirect(`/customers/${customerId}`);
    } catch (err) {
        console.error(err);
        const breeds = await petModel.getBreeds();
        res.render('pets/create', { title: 'Thêm thú cưng', breeds, customerId: customerId || '', error: err.message, employee: req.session.employee });
    }
});

// View pet detail
router.get('/:id(\\d+)', requireRole('RECEP', 'VET', 'MGR', 'DIRECTOR', 'SALES'), async (req, res) => {
    try {
        const pet = await petModel.getById(req.params.id);
        if (!pet) return res.redirect('/pets');
        res.render('pets/detail', { title: pet.PET_NAME, pet, employee: req.session.employee });
    } catch (err) {
        res.redirect('/pets');
    }
});

export default router;
