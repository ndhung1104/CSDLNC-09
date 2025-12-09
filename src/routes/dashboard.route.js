import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import db from '../utils/db.js';

const router = Router();

router.get('/', requireRole('RECEP', 'VET', 'SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const emp = req.session.employee;
    const stats = {};
    try {
        stats.totalCustomers = (await db('CUSTOMER').count('* as c').first())?.c || 0;
        stats.totalPets = (await db('PET').count('* as c').first())?.c || 0;
    } catch (e) { console.error(e); }
    res.render('dashboard', { title: 'Trang chủ', employee: emp, stats });
});

export default router;
