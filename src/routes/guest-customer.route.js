import { Router } from 'express';
import * as demoData from '../services/demoData.service.js';
import { requireCustomer } from '../middleware/customer.middleware.js';
import * as customerModel from '../models/customer.model.js';
import * as petModel from '../models/pet.model.js';
import * as checkupModel from '../models/checkup.model.js';
import * as receiptModel from '../models/receipt.model.js';
import * as reportModel from '../models/report.model.js';
import * as appointmentModel from '../models/appointment.model.js';
import * as productModel from '../models/product.model.js';
import * as employeeModel from '../models/employee.model.js';

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

function mapServices(services) {
  return (services || []).map(s => ({
    serviceId: s.id || s.serviceId,
    serviceName: s.name || s.serviceName,
    price: s.fee || s.price || 0,
  }));
}

function mapBranches(branches) {
  return (branches || []).map(b => ({
    branchId: b.id || b.branchId,
    branchName: b.name || b.branchName,
    address: b.address || '',
  }));
}

function formatTimeValue(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().substring(11, 16);
  }
  const text = String(value);
  const match = text.match(/\d{2}:\d{2}/);
  return match ? match[0] : text;
}

function buildVetScheduleOverview(rows) {
  const vetMap = new Map();
  (rows || []).forEach(row => {
    const key = `${row.vetId}-${row.branchId}`;
    if (!vetMap.has(key)) {
      vetMap.set(key, {
        vetId: row.vetId,
        vetName: row.vetName,
        branchId: row.branchId,
        branchName: row.branchName,
        days: {}
      });
    }
    const vet = vetMap.get(key);
    const dayKey = String(row.dayOfWeek || '');
    if (!vet.days[dayKey]) vet.days[dayKey] = [];
    vet.days[dayKey].push({
      startTime: formatTimeValue(row.startTime),
      endTime: formatTimeValue(row.endTime),
      slotMinutes: row.slotMinutes
    });
  });
  return Array.from(vetMap.values());
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
        appointmentTime: a.date ? new Date(a.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
        branchName: a.branchName,
        vetName: a.vetName || '',
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
        appointmentTime: a.date ? new Date(a.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
        branchName: a.branchName,
        vetName: a.vetName || '',
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
        appointmentTime: c.date ? new Date(c.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '',
        branchName: c.branchName || '',
        vetName: c.vetName || '',
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

router.get('/vets/schedule', requireCustomer, async (req, res) => {
  try {
    const branches = mapBranches(await reportModel.getBranches());
    const branchParam = req.query.branchId || 'all';
    const selectedBranchId = branchParam === 'all' ? null : parseInt(branchParam, 10);
    const schedules = await appointmentModel.getVetScheduleOverview({ branchId: selectedBranchId });
    const vets = buildVetScheduleOverview(schedules);

    renderCustomerPage(res, 'customer/vet-schedule', {
      title: 'Vet Schedule',
      branches,
      selectedBranchId: branchParam === 'all' ? 'all' : (Number.isFinite(selectedBranchId) ? selectedBranchId : ''),
      vets
    });
  } catch (err) {
    console.error('Guest vet schedule error:', err);
    renderCustomerPage(res, 'customer/vet-schedule', {
      title: 'Vet Schedule',
      branches: [],
      selectedBranchId: 'all',
      vets: [],
      error: 'Unable to load vet schedule'
    });
  }
});

router.get('/appointments/available-vets', requireCustomer, async (req, res) => {
  const { branchId, appointmentDate, appointmentTime } = req.query;
  if (!branchId || !appointmentDate || !appointmentTime) return res.json([]);

  try {
    const vets = await appointmentModel.getAvailableVets({ branchId, appointmentDate, appointmentTime });
    res.json(vets);
  } catch (err) {
    console.error('Guest available vets error:', err);
    res.status(500).json({ error: 'Unable to load vets' });
  }
});

router.get('/appointments/new', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.customer?.id;
    const pets = await petModel.getByCustomerId(customerId);
    const branches = mapBranches(await reportModel.getBranches());
    const branchServices = await appointmentModel.getServicesByBranch();
    const initialBranchId = branches[0]?.branchId;
    const services = initialBranchId ? (branchServices[initialBranchId] || []) : [];

    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'New Appointment',
      pets,
      services,
      branches,
      branchServices,
    });
  } catch (err) {
    console.error('Guest appointment-new error:', err);
    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'New Appointment',
      pets: [],
      services: [],
      branches: [],
      branchServices: {},
      error: 'Unable to load form data',
    });
  }
});

// Create appointment
router.post('/appointments', requireCustomer, async (req, res) => {
  const customerId = req.session.customer?.id;
  const { branchId, serviceId, appointmentDate, appointmentTime, notes, vetId } = req.body;

  try {
    if (!branchId || !serviceId || !appointmentDate || !appointmentTime) {
      throw new Error('Missing required fields');
    }

    const available = await appointmentModel.isBranchServiceAvailable({ branchId, serviceId });
    if (!available) {
      throw new Error('Selected service is not available at this branch. Please choose another branch/service.');
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
      status: 'Pending',
    });

    res.redirect('/guest/customer/appointments');
  } catch (err) {
    console.error('Create appointment error:', err);
    const pets = await petModel.getByCustomerId(customerId);
    const branches = mapBranches(await reportModel.getBranches());
    const branchServices = await appointmentModel.getServicesByBranch();
    const services = [];
    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'New Appointment',
      pets,
      services,
      branches,
      branchServices,
      error: err.message || 'Unable to create appointment',
    });
  }
});

// Edit appointment
router.get('/appointments/:id/edit', requireCustomer, async (req, res) => {
  try {
    const customerId = req.session.customer?.id;
    const appt = await appointmentModel.getByIdForCustomer({ appointmentId: req.params.id, customerId });
    if (!appt) return res.redirect('/guest/customer/appointments');

    const pets = await petModel.getByCustomerId(customerId);
    const branches = mapBranches(await reportModel.getBranches());
    const branchServices = await appointmentModel.getServicesByBranch();
    const services = branchServices[appt.branchId] || [];

    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'Edit Appointment',
      pets,
      branches,
      services,
      branchServices,
      appointment: appt,
    });
  } catch (err) {
    console.error('Guest appointment-edit error:', err);
    res.redirect('/guest/customer/appointments');
  }
});

// Update appointment
router.post('/appointments/:id', requireCustomer, async (req, res) => {
  const customerId = req.session.customer?.id;
  const { branchId, serviceId, appointmentDate, appointmentTime, status, vetId } = req.body;
  const appointmentId = req.params.id;

  try {
    if (!branchId || !serviceId || !appointmentDate || !appointmentTime) {
      throw new Error('Missing required fields');
    }

    const available = await appointmentModel.isBranchServiceAvailable({ branchId, serviceId });
    if (!available) {
      throw new Error('Selected service is not available at this branch. Please choose another branch/service.');
    }

    const availableVets = await appointmentModel.getAvailableVets({
      branchId,
      appointmentDate,
      appointmentTime,
      excludeAppointmentId: appointmentId
    });
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

    await appointmentModel.update({
      appointmentId,
      customerId,
      branchId,
      serviceId,
      vetId: selectedVetId,
      appointmentDate: apptDate,
      status: status || 'Pending',
    });

    res.redirect('/guest/customer/appointments');
  } catch (err) {
    console.error('Update appointment error:', err);
    const pets = await petModel.getByCustomerId(customerId);
    const branches = mapBranches(await reportModel.getBranches());
    const branchServices = await appointmentModel.getServicesByBranch();
    const services = branchServices[branchId] || [];
    renderCustomerPage(res, 'customer/appointment-new', {
      title: 'Edit Appointment',
      pets,
      services,
      branches,
      branchServices,
      error: err.message || 'Unable to update appointment',
    });
  }
});

// Cancel appointment
router.post('/appointments/:id/cancel', requireCustomer, async (req, res) => {
  const customerId = req.session.customer?.id;
  try {
    await appointmentModel.cancel({ appointmentId: req.params.id, customerId });
  } catch (err) {
    console.error('Cancel appointment error:', err);
  }
  res.redirect('/guest/customer/appointments');
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

router.get('/pets/:id/history', requireCustomer, async (req, res) => {
  const customerId = req.session.customer?.id;
  const { fromDate = '', toDate = '', status = '' } = req.query;
  try {
    const petRecord = await petModel.getById(req.params.id);
    if (!petRecord || petRecord.CUSTOMER_ID !== customerId) {
      return res.redirect('/guest/customer/pets');
    }

    const pet = {
      id: petRecord.PET_ID || petRecord.id,
      name: petRecord.PET_NAME || petRecord.name,
      breed: petRecord.breedName || petRecord.breed,
      type: petRecord.typeOfPet || petRecord.type,
      gender: petRecord.PET_GENDER || petRecord.gender,
      birthdate: petRecord.PET_BIRTHDATE || petRecord.birthdate,
      healthStatus: petRecord.PET_HEALTH_STATUS || petRecord.healthStatus,
    };

    const checkups = await checkupModel.getByPetId(pet.id);
    const receipts = await receiptModel.getByPetIdForCustomer({ petId: pet.id, customerId });

    const fromDateValue = fromDate ? new Date(fromDate) : null;
    const toDateValue = toDate ? new Date(`${toDate}T23:59:59`) : null;
    const normalizeStatus = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const statusValue = normalizeStatus(status);
    const statusMatchers = {
      pending: ['cho', 'pending'],
      'in progress': ['dang', 'progress'],
      completed: ['hoan', 'complete']
    };
    const statusTokens = statusValue ? (statusMatchers[statusValue] || [statusValue]) : [];
    const matchesStatus = (rawStatus) => {
      if (!statusTokens.length) return true;
      const normalized = normalizeStatus(rawStatus);
      return statusTokens.some(token => normalized.includes(token));
    };

    const filteredCheckups = checkups.filter(c => {
      const dateValue = c.date ? new Date(c.date) : null;
      if (fromDateValue && dateValue && dateValue < fromDateValue) return false;
      if (toDateValue && dateValue && dateValue > toDateValue) return false;
      if (!matchesStatus(c.status)) return false;
      return true;
    });

    const filteredReceipts = receipts.filter(r => {
      const dateValue = r.date ? new Date(r.date) : null;
      if (fromDateValue && dateValue && dateValue < fromDateValue) return false;
      if (toDateValue && dateValue && dateValue > toDateValue) return false;
      if (!matchesStatus(r.status)) return false;
      return true;
    });

    renderCustomerPage(res, 'customer/pet-history', {
      title: `History - ${pet.name}`,
      pet,
      checkups: filteredCheckups,
      receipts: filteredReceipts,
      filters: { fromDate, toDate, status }
    });
  } catch (err) {
    console.error('Guest pet history error:', err);
    res.redirect('/guest/customer/pets');
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

router.get('/products', requireCustomer, async (req, res) => {
  const { search = '', page = 1 } = req.query;
  try {
    const { products, total, limit } = await productModel.getAll({
      search,
      page: parseInt(page) || 1
    });
    const totalPages = Math.ceil(total / limit);
    renderCustomerPage(res, 'customer/products', {
      title: 'Products',
      products,
      search,
      page: parseInt(page) || 1,
      totalPages
    });
  } catch (err) {
    console.error('Guest products error:', err);
    renderCustomerPage(res, 'customer/products', {
      title: 'Products',
      products: [],
      search,
      page: 1,
      totalPages: 0,
      error: 'Unable to load products'
    });
  }
});

router.get('/products/:id/purchase', requireCustomer, async (req, res) => {
  try {
    const product = await productModel.getById(req.params.id);
    if (!product) return res.redirect('/guest/customer/products');
    renderCustomerPage(res, 'customer/product-purchase', {
      title: `Buy ${product.name}`,
      product,
      error: null
    });
  } catch (err) {
    console.error('Guest product purchase error:', err);
    res.redirect('/guest/customer/products');
  }
});

router.post('/products/:id/purchase', requireCustomer, async (req, res) => {
  const customerId = req.session.customer?.id;
  const { branchId, quantity } = req.body;
  try {
    const product = await productModel.getById(req.params.id);
    if (!product) return res.redirect('/guest/customer/products');

    const branchIdNum = parseInt(branchId);
    const qty = parseInt(quantity);
    if (!branchIdNum || !qty || qty < 1) {
      throw new Error('Please select a branch and quantity.');
    }

    const employee = await employeeModel.getReceptionistByBranch(branchIdNum)
      || await employeeModel.getAnyEmployeeByBranch(branchIdNum);
    if (!employee) {
      throw new Error('No staff available for the selected branch.');
    }

    await productModel.purchase({
      productId: req.params.id,
      quantity: qty,
      customerId,
      branchId: branchIdNum,
      employeeId: employee.id
    });

    res.redirect('/guest/customer/receipts');
  } catch (err) {
    console.error('Guest product purchase submit error:', err);
    const product = await productModel.getById(req.params.id);
    renderCustomerPage(res, 'customer/product-purchase', {
      title: `Buy ${product?.name || 'Product'}`,
      product,
      error: err.message || 'Unable to complete purchase'
    });
  }
});

// Add pet
router.get('/pets/add', requireCustomer, async (req, res) => {
  try {
    const breeds = await petModel.getBreeds();
    renderCustomerPage(res, 'customer/pet-add', {
      title: 'Add Pet',
      breeds,
    });
  } catch (err) {
    console.error('Guest pet-add error:', err);
    renderCustomerPage(res, 'customer/pet-add', {
      title: 'Add Pet',
      breeds: [],
      error: 'Unable to load breeds',
    });
  }
});

router.post('/pets/add', requireCustomer, async (req, res) => {
  const customerId = req.session.customer?.id;
  const { name, breedId, gender, birthdate, healthStatus } = req.body;
  try {
    if (!name || !breedId || !gender) throw new Error('Missing required fields');
    await petModel.createForCustomer({
      customerId,
      breedId,
      name,
      gender,
      birthdate: birthdate || null,
      healthStatus: healthStatus || 'Khỏe mạnh',
    });
    res.redirect('/guest/customer/pets');
  } catch (err) {
    console.error('Create pet error:', err);
    const breeds = await petModel.getBreeds();
    renderCustomerPage(res, 'customer/pet-add', {
      title: 'Add Pet',
      breeds,
      error: err.message || 'Unable to add pet',
    });
  }
});

export default router;
