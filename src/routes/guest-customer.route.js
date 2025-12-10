import { Router } from 'express';
import * as demoData from '../services/demoData.service.js';
import { requireCustomer } from '../middleware/customer.middleware.js';
import * as customerModel from '../models/customer.model.js';
import * as petModel from '../models/pet.model.js';
import * as checkupModel from '../models/checkup.model.js';
import * as receiptModel from '../models/receipt.model.js';
import * as reportModel from '../models/report.model.js';
import * as appointmentModel from '../models/appointment.model.js';

const {
  getCustomerDashboardData,
  getCustomerAppointmentsData,
  getCustomerNewAppointmentData,
  getCustomerPetsData,
  getCustomerReceiptsData,
} = demoData;

const basePath = '/guest/customer';

const router = Router();

function renderCustomerPage(res, view, options = {}) {
  const layout = 'layouts/layout-customer';
  const merged = { basePath, showManagementLink: false, ...options };
  res.render(view, merged, (err, content) => {
    if (err) return res.status(500).send(err.message);
    res.render(layout, { ...merged, body: content }, (layoutErr, html) => {
      if (layoutErr) return res.status(500).send(layoutErr.message);
      res.send(html);
    });
  });
}

// Redirect base to dashboard for convenience
router.get('/', requireCustomer, (_req, res) => {
  res.redirect(`${basePath}/dashboard`);
});

router.get('/home', (_req, res) => {
  renderCustomerPage(res, 'customer/home', {
    title: 'Home',
    user: null,
  });
});

router.get('/dashboard', requireCustomer, async (req, res) => {
  try {
    const profile = await customerModel.getProfileById(req.session.customer?.id);
    if (!profile) return res.redirect('/guest/customer/logout');

    // Real pets from DB
    const pets = await petModel.getByCustomerId(profile.id);

    // Appointments stats (from APPOINTMENT table)
    const appointments = await appointmentModel.getByCustomerId(profile.id);
    const upcomingAppointments = appointments
      .filter(a => {
        const status = (a.status || '').toLowerCase();
        const isCancelled = status.includes('hủy') || status.includes('cancel');
        const isDone = status.includes('hoàn') || status.includes('done') || status.includes('complete');
        const isFuture = new Date(a.date) > new Date();
        return !isCancelled && !isDone && isFuture;
      })
      .slice(0, 5);

    const data = {
      pets,
      stats: {
        totalPets: pets.length,
        upcomingAppointments: upcomingAppointments.length,
      },
      upcomingAppointments: upcomingAppointments.map(a => ({
        appointmentId: a.id,
        serviceName: a.serviceName,
        appointmentDate: a.date,
        appointmentTime: '',
        branchName: a.branchName,
        petName: '',
        status: a.status,
      })),
    };

    const user = {
      name: profile.name,
      email: profile.email,
      initials: profile.name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'CU',
    };

    renderCustomerPage(res, 'customer/dashboard', {
      title: 'Dashboard',
      user,
      customer: {
        name: profile.name,
        loyaltyPoints: profile.loyalty,
        membershipRank: profile.membershipRank,
      },
      ...data,
    });
  } catch (err) {
    console.error('Guest dashboard error:', err);
    res.redirect('/guest/customer/logout');
  }
});

router.get('/appointments', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.customer?.id;
    const checkups = await checkupModel.getByCustomerId(customerId);
    const appointments = await appointmentModel.getByCustomerId(customerId);

    const upcoming = [];
    const past = [];
    const cancelled = [];

    appointments.forEach(a => {
      const status = (a.status || '').toLowerCase();
      const record = {
        appointmentId: a.id,
        serviceName: a.serviceName,
        status: a.status || 'Unknown',
        appointmentDate: a.date,
        appointmentTime: '',
        branchName: a.branchName,
        petName: '',
        notes: '',
      };
      if (status.includes('hủy') || status.includes('cancel')) cancelled.push(record);
      else if (status.includes('hoàn') || status.includes('done') || status.includes('complete')) past.push(record);
      else upcoming.push(record);
    });

    checkups.forEach(c => {
      const status = (c.status || '').toLowerCase();
      const record = {
        appointmentId: c.id,
        serviceName: c.symptoms || 'Check-up',
        status: c.status || 'Unknown',
        appointmentDate: c.date,
        appointmentTime: '',
        branchName: c.branchName || '',
        petName: c.petName,
        notes: c.diagnosis || '',
      };
      if (status.includes('hủy') || status.includes('cancel')) cancelled.push(record);
      else if (status.includes('hoàn') || status.includes('done') || status.includes('complete')) past.push(record);
      else upcoming.push(record);
    });

    renderCustomerPage(res, 'customer/appointments', {
      title: 'Appointments',
      upcomingAppointments: upcoming,
      pastAppointments: past,
      cancelledAppointments: cancelled,
    });
  } catch (err) {
    console.error('Guest appointments error:', err);
    renderCustomerPage(res, 'customer/appointments', {
      title: 'Appointments',
      upcomingAppointments: [],
      pastAppointments: [],
      cancelledAppointments: [],
      error: 'Unable to load appointments',
    });
  }
});

router.get('/appointments/new', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.customer?.id;
    const pets = await petModel.getByCustomerId(customerId);
    const services = await checkupModel.getMedicalServices();
    const branches = await reportModel.getBranches();

    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'New Appointment',
      pets,
      services,
      branches,
    });
  } catch (err) {
    console.error('Guest appointment-new error:', err);
    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'New Appointment',
      pets: [],
      services: [],
      branches: [],
      error: 'Unable to load form data',
    });
  }
});

router.get('/pets', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.customer?.id;
    const pets = await petModel.getByCustomerId(customerId);
    renderCustomerPage(res, 'customer/pets', {
      title: 'My Pets',
      pets,
    });
  } catch (err) {
    console.error('Guest pets error:', err);
    renderCustomerPage(res, 'customer/pets', {
      title: 'My Pets',
      pets: [],
      error: 'Unable to load pets',
    });
  }
});

router.get('/receipts', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.customer?.id;
    const receipts = await receiptModel.getByCustomerId(customerId);
    renderCustomerPage(res, 'customer/receipts', {
      title: 'Receipts',
      receipts,
    });
  } catch (err) {
    console.error('Guest receipts error:', err);
    renderCustomerPage(res, 'customer/receipts', {
      title: 'Receipts',
      receipts: [],
      error: 'Unable to load receipts',
    });
  }
});

export default router;
