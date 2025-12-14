import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as petModel from '../models/pet.model.js';

const router = Router();

// List pets
router.get('/', requireAnyEmployee(), async (req, res) => {
    const { search = '', searchBy = 'pet', page = 1 } = req.query;
    try {
        const { pets, total, limit } = await petModel.getAll({ search, searchBy, page: parseInt(page) });
        const totalPages = Math.ceil(total / limit);
        res.render('pets/list', {
            title: 'Thú cưng', pets, search, searchBy, page: parseInt(page), totalPages, total, error: null,
            employee: req.session.employee
        });
    } catch (err) {
        console.error(err);
        res.render('pets/list', { title: 'Thú cưng', pets: [], search: '', searchBy: 'pet', page: 1, totalPages: 0, total: 0, error: err.message, employee: req.session.employee });
    }
});

// Create pet form
router.get('/create', requireAnyEmployee(), async (req, res) => {
    const breeds = await petModel.getBreeds();
    res.render('pets/create', {
        title: 'Thêm thú cưng', breeds,
        customerId: req.query.customerId || '',
        employee: req.session.employee, error: null
    });
});

// Create pet - Use Case 1
router.post('/create', requireAnyEmployee(), async (req, res) => {
    const { customerId, breedId, name, gender, weight } = req.body;
    try {
        await petModel.create({ customerId, breedId, name, gender, weight });
        res.redirect(`/customers/${customerId}`);
    } catch (err) {
        console.error(err);
        const breeds = await petModel.getBreeds();
        res.render('pets/create', { title: 'Thêm thú cưng', breeds, customerId, error: err.message, employee: req.session.employee });
    }
});

// View pet detail
router.get('/:id', requireAnyEmployee(), async (req, res) => {
    try {
        const pet = await petModel.getById(req.params.id);
        if (!pet) return res.redirect('/pets');
        res.render('pets/detail', { title: pet.PET_NAME, pet, employee: req.session.employee });
    } catch (err) {
        res.redirect('/pets');
    }
});

export default router;
