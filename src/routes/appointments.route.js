import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import * as appointmentModel from '../models/appointment.model.js';
import * as reportModel from '../models/report.model.js';

const router = Router();

// Create appointment form (walk-in)
router.get('/new', requireRole('RECEP', 'SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const emp = req.session.employee;
    try {
        const branches = await reportModel.getBranches();
        const branchServices = await appointmentModel.getServicesByBranch();
        const initialBranchId = emp?.branchId || branches[0]?.id;
        const services = initialBranchId ? (branchServices[initialBranchId] || []) : [];

        res.render('appointments/create', {
            title: 'New Appointment',
            branches,
            services,
            branchServices,
            selectedBranchId: initialBranchId,
            error: null,
            success: req.query.success || null,
            employee: emp
        });
    } catch (err) {
        console.error(err);
        res.render('appointments/create', {
            title: 'New Appointment',
            branches: [],
            services: [],
            branchServices: {},
            selectedBranchId: null,
            error: err.message,
            success: null,
            employee: emp
        });
    }
});

// Create appointment
router.post('/', requireRole('RECEP', 'SALES', 'MGR', 'DIRECTOR'), async (req, res) => {
    const { customerId, branchId, serviceId, appointmentDate, appointmentTime, vetId } = req.body;
    const emp = req.session.employee;
    try {
        if (!customerId || !branchId || !serviceId || !appointmentDate || !appointmentTime) {
            throw new Error('Missing required fields');
        }

        const available = await appointmentModel.isBranchServiceAvailable({ branchId, serviceId });
        if (!available) {
            throw new Error('Selected service is not available at this branch.');
        }

        const availableVets = await appointmentModel.getAvailableVets({ branchId, appointmentDate, appointmentTime });
        let selectedVetId = vetId ? parseInt(vetId, 10) : null;
        if (selectedVetId) {
            const isValidVet = availableVets.some(v => String(v.vetId) === String(selectedVetId));
            if (!isValidVet) throw new Error('Selected vet is not available for this time slot.');
        } else {
            selectedVetId = availableVets[0]?.vetId || null;
        }
        if (!selectedVetId) {
            throw new Error('No vets available for this time slot.');
        }

        const dateTimeString = `${appointmentDate}T${appointmentTime}:00`;
        const apptDate = new Date(dateTimeString);

        await appointmentModel.create({
            customerId,
            branchId,
            serviceId,
            vetId: selectedVetId,
            appointmentDate: apptDate,
            status: 'Pending'
        });

        res.redirect('/appointments/new?success=Appointment+created');
    } catch (err) {
        console.error(err);
        const branches = await reportModel.getBranches();
        const branchServices = await appointmentModel.getServicesByBranch();
        const services = branchServices[branchId] || [];
        res.render('appointments/create', {
            title: 'New Appointment',
            branches,
            services,
            branchServices,
            selectedBranchId: branchId,
            error: err.message,
            success: null,
            employee: emp
        });
    }
});

export default router;
