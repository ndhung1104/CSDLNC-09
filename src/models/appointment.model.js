import db from '../utils/db.js';

// Get appointments for a customer with branch/service names
export async function getByCustomerId(customerId) {
  return db('APPOINTMENT as a')
    .join('BRANCH as b', 'a.BRANCH_ID', 'b.BRANCH_ID')
    .join('SERVICE as s', 'a.SERVICE_ID', 's.SERVICE_ID')
    .select(
      'a.APPOINTMENT_ID as id',
      'a.APPOINTMENT_DATE as date',
      'a.APPOINTMENT_STATUS as status',
      'a.APPOINTMENT_CREATE_DATE as createdAt',
      'b.BRANCH_NAME as branchName',
      's.SERVICE_NAME as serviceName'
    )
    .where('a.CUSTOMER_ID', customerId)
    .orderBy('a.APPOINTMENT_DATE', 'desc');
}

export async function getByIdForCustomer({ appointmentId, customerId }) {
  return db('APPOINTMENT as a')
    .join('BRANCH as b', 'a.BRANCH_ID', 'b.BRANCH_ID')
    .join('SERVICE as s', 'a.SERVICE_ID', 's.SERVICE_ID')
    .select(
      'a.APPOINTMENT_ID as id',
      'a.APPOINTMENT_DATE as date',
      'a.APPOINTMENT_STATUS as status',
      'a.BRANCH_ID as branchId',
      'a.SERVICE_ID as serviceId',
      'b.BRANCH_NAME as branchName',
      's.SERVICE_NAME as serviceName'
    )
    .where('a.APPOINTMENT_ID', appointmentId)
    .andWhere('a.CUSTOMER_ID', customerId)
    .first();
}

// Create a new appointment
export async function create({ customerId, branchId, serviceId, appointmentDate, status = 'Pending' }) {
  const result = await db.raw(`
    DECLARE @NewId INT;
    INSERT INTO APPOINTMENT (
      CUSTOMER_ID,
      BRANCH_ID,
      SERVICE_ID,
      APPOINTMENT_CREATE_DATE,
      APPOINTMENT_DATE,
      APPOINTMENT_STATUS
    )
    VALUES (?, ?, ?, GETDATE(), ?, ?);
    SELECT @NewId = SCOPE_IDENTITY();
    SELECT @NewId AS id;
  `, [customerId, branchId, serviceId, appointmentDate, status]);

  return result[0]?.id || null;
}

// Check if a service is offered at a branch
export async function isBranchServiceAvailable({ branchId, serviceId }) {
  const row = await db('BRANCH_SERVICE')
    .where({ BRANCH_ID: branchId, SERVICE_ID: serviceId })
    .first();
  return !!row;
}

// Get available services grouped by branch
export async function getServicesByBranch() {
  const rows = await db('BRANCH_SERVICE as bs')
    .join('SERVICE as s', 'bs.SERVICE_ID', 's.SERVICE_ID')
    .select(
      'bs.BRANCH_ID as branchId',
      's.SERVICE_ID as id',
      's.SERVICE_NAME as name'
    );

  const map = {};
  rows.forEach(r => {
    if (!map[r.branchId]) map[r.branchId] = [];
    map[r.branchId].push({ serviceId: r.id, serviceName: r.name, price: 0 });
  });
  return map;
}

// Update appointment
export async function update({ appointmentId, customerId, branchId, serviceId, appointmentDate, status }) {
  await db('APPOINTMENT')
    .where('APPOINTMENT_ID', appointmentId)
    .andWhere('CUSTOMER_ID', customerId)
    .update({
      BRANCH_ID: branchId,
      SERVICE_ID: serviceId,
      APPOINTMENT_DATE: appointmentDate,
      APPOINTMENT_STATUS: status || 'Pending',
    });
}

// Cancel appointment
export async function cancel({ appointmentId, customerId }) {
  await db('APPOINTMENT')
    .where('APPOINTMENT_ID', appointmentId)
    .andWhere('CUSTOMER_ID', customerId)
    .update({ APPOINTMENT_STATUS: 'Cancelled' });
}
