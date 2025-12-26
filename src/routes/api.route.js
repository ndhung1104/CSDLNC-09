import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import db from '../utils/db.js';
import * as appointmentModel from '../models/appointment.model.js';
import * as receiptModel from '../models/receipt.model.js';

const router = Router();

// Search customers API
router.get('/customers', requireRole('RECEP', 'SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const { q = '' } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const customers = await db('CUSTOMER')
            .where('CUSTOMER_NAME', 'like', `%${q}%`)
            .orWhere('CUSTOMER_PHONE', 'like', `%${q}%`)
            .orWhere('CUSTOMER_EMAIL', 'like', `%${q}%`)
            .select('CUSTOMER_ID as id', 'CUSTOMER_NAME as name', 'CUSTOMER_PHONE as phone', 'CUSTOMER_EMAIL as email')
            .limit(20);

        res.json(customers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search pets API
router.get('/pets', requireRole('RECEP', 'SALES', 'MGR', 'DIRECTOR', 'VET'), async (req, res) => {
    const { q = '' } = req.query;
    if (!q) return res.json([]);

    try {
        const pets = await db('PET')
            .join('CUSTOMER', 'PET.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
            .join('PET_BREED', 'PET.PET_BREED_ID', 'PET_BREED.BREED_ID')
            .where('PET.PET_NAME', 'like', `%${q}%`)
            .orWhere('CUSTOMER.CUSTOMER_NAME', 'like', `%${q}%`)
            .orWhere('CUSTOMER.CUSTOMER_PHONE', 'like', `%${q}%`)
            .select(
                'PET.PET_ID as id',
                'PET.PET_NAME as name',
                'CUSTOMER.CUSTOMER_NAME as ownerName',
                'PET_BREED.BREED_NAME as breedName'
            )
            .limit(20);

        res.json(pets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Available vets for a branch/time slot
router.get('/vets/available', requireRole('RECEP', 'SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const { branchId, appointmentDate, appointmentTime } = req.query;
    if (!branchId || !appointmentDate || !appointmentTime) return res.json([]);

    try {
        const vets = await appointmentModel.getAvailableVets({ branchId, appointmentDate, appointmentTime });
        res.json(vets);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lookup vaccination record by ID
router.get('/vaccinations/:id', requireRole('RECEP', 'SALES', 'MGR', 'DIRECTOR', 'VET'), async (req, res) => {
    const vaccinationId = parseInt(req.params.id);
    if (!vaccinationId) return res.status(400).json({ error: 'Invalid vaccination ID' });

    try {
        const vaccination = await receiptModel.getVaccinationById(vaccinationId);
        if (!vaccination) return res.status(404).json({ error: 'Vaccination not found' });
        res.json(vaccination);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
