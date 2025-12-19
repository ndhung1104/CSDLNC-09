import { Router } from 'express';
import { requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as productModel from '../models/product.model.js';

const router = Router();

// List medicines for vets
router.get('/', requireAnyEmployee(), async (req, res) => {
    const { search = '', page = 1 } = req.query;
    const emp = req.session.employee;
    try {
        const { products, total, limit } = await productModel.getMedicines({
            search,
            branchId: emp.branchId,
            page: parseInt(page)
        });
        const totalPages = Math.ceil(total / limit);
        res.render('medicines/list', {
            title: 'Medicines',
            products,
            search,
            page: parseInt(page),
            totalPages,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error(err);
        res.render('medicines/list', {
            title: 'Medicines',
            products: [],
            search: '',
            page: 1,
            totalPages: 0,
            error: err.message,
            employee: emp
        });
    }
});

export default router;
