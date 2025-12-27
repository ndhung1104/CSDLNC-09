import { Router } from 'express';
import { requireRole, requireAnyEmployee } from '../middleware/auth.middleware.js';
import * as appointmentModel from '../models/appointment.model.js';
import * as reportModel from '../models/report.model.js';

const router = Router();

// List appointments
router.get('/', requireAnyEmployee(), async (req, res) => {
    const emp = req.session.employee;
    const { status = '', page = 1, fromDate = '', toDate = '', q = '' } = req.query;
    try {
        const { appointments, total, limit } = await appointmentModel.getAll({
            status: status || null,
            fromDate: fromDate || null,
            toDate: toDate || null,
            q: q || '',
            page: parseInt(page, 10) || 1
        });
        const totalPages = Math.ceil(total / limit);
        res.render('appointments/list', {
            title: 'Appointments',
            appointments,
            status,
            fromDate,
            toDate,
            q,
            page: parseInt(page, 10) || 1,
            totalPages,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error('Appointments list error:', err);
        res.render('appointments/list', {
            title: 'Appointments',
            appointments: [],
            status: status || '',
            fromDate,
            toDate,
            q,
            page: 1,
            totalPages: 0,
            error: err.message,
            employee: emp
        });
    }
});

// Update appointment status
router.post('/:id/status', requireAnyEmployee(), async (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id, 10);
        const status = req.body.status;
        if (!appointmentId || !status) {
            throw new Error('Missing required fields');
        }
        await appointmentModel.updateStatus({ appointmentId, status });
        res.redirect('/appointments');
    } catch (err) {
        console.error('Appointment status update error:', err);
        res.redirect(`/appointments?error=${encodeURIComponent(err.message)}`);
    }
});

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
