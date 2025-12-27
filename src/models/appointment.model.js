import db from '../utils/db.js';

function toIsoDayOfWeek(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay(); // 0 (Sun) - 6 (Sat)
  return day === 0 ? 7 : day;
}

function normalizeTime(value) {
  if (!value) return null;
  if (value.length === 5) return `${value}:00`;
  return value;
}

// Get appointments for a customer with branch/service names
export async function getByCustomerId(customerId) {
  return db('APPOINTMENT as a')
    .join('BRANCH as b', 'a.BRANCH_ID', 'b.BRANCH_ID')
    .join('SERVICE as s', 'a.SERVICE_ID', 's.SERVICE_ID')
    .leftJoin('EMPLOYEE as e', 'a.VET_ID', 'e.EMPLOYEE_ID')
    .select(
      'a.APPOINTMENT_ID as id',
      'a.APPOINTMENT_DATE as date',
      'a.APPOINTMENT_STATUS as status',
      'a.APPOINTMENT_CREATE_DATE as createdAt',
      'b.BRANCH_NAME as branchName',
      's.SERVICE_NAME as serviceName',
      'e.EMPLOYEE_NAME as vetName'
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
      'a.VET_ID as vetId',
      'b.BRANCH_NAME as branchName',
      's.SERVICE_NAME as serviceName'
    )
    .where('a.APPOINTMENT_ID', appointmentId)
    .andWhere('a.CUSTOMER_ID', customerId)
    .first();
}

// Create a new appointment
export async function create({ customerId, branchId, serviceId, vetId = null, appointmentDate, status = 'Pending' }) {
  const result = await db.raw(`
    DECLARE @NewId INT;
    INSERT INTO APPOINTMENT (
      CUSTOMER_ID,
      BRANCH_ID,
      SERVICE_ID,
      VET_ID,
      APPOINTMENT_CREATE_DATE,
      APPOINTMENT_DATE,
      APPOINTMENT_STATUS
    )
    VALUES (?, ?, ?, ?, GETDATE(), ?, ?);
    SELECT @NewId = SCOPE_IDENTITY();
    SELECT @NewId AS id;
  `, [customerId, branchId, serviceId, vetId, appointmentDate, status]);

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
    .whereRaw('s.SERVICE_NAME COLLATE Latin1_General_CI_AI NOT LIKE ?', ['%ban le%'])
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
export async function update({ appointmentId, customerId, branchId, serviceId, vetId = null, appointmentDate, status }) {
  await db('APPOINTMENT')
    .where('APPOINTMENT_ID', appointmentId)
    .andWhere('CUSTOMER_ID', customerId)
    .update({
      BRANCH_ID: branchId,
      SERVICE_ID: serviceId,
      VET_ID: vetId,
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

export async function getAvailableVets({ branchId, appointmentDate, appointmentTime, excludeAppointmentId = null }) {
  const dayOfWeek = toIsoDayOfWeek(appointmentDate);
  const timeValue = normalizeTime(appointmentTime);
  if (!dayOfWeek || !timeValue) return [];

  const dateValue = appointmentDate instanceof Date
    ? appointmentDate.toISOString().split('T')[0]
    : appointmentDate;

  const countQuery = db('APPOINTMENT')
    .where('BRANCH_ID', branchId)
    .andWhereRaw('CAST(APPOINTMENT_DATE AS DATE) = ?', [dateValue])
    .andWhereRaw('CAST(APPOINTMENT_DATE AS TIME) = ?', [timeValue])
    .whereNot('APPOINTMENT_STATUS', 'Cancelled');
  if (excludeAppointmentId) {
    countQuery.andWhereNot('APPOINTMENT_ID', excludeAppointmentId);
  }
  const countRow = await countQuery.count({ total: '*' }).first();

  if (parseInt(countRow?.total || 0, 10) >= 5) return [];

  return db('VET_SCHEDULE as vs')
    .join('EMPLOYEE as e', 'vs.VET_ID', 'e.EMPLOYEE_ID')
    .select(
      'vs.VET_ID as vetId',
      'e.EMPLOYEE_NAME as vetName'
    )
    .where('vs.BRANCH_ID', branchId)
    .andWhere('vs.DAY_OF_WEEK', dayOfWeek)
    .andWhereRaw('? >= vs.START_TIME', [timeValue])
    .andWhereRaw('CAST(DATEADD(MINUTE, vs.SLOT_MINUTES, CAST(? AS time)) AS time) <= vs.END_TIME', [timeValue])
    .andWhere('e.EMPLOYEE_POSITION', 'VET')
    .whereNotExists(function () {
      this.select(1)
        .from('APPOINTMENT as a')
        .whereRaw('a.VET_ID = vs.VET_ID')
        .andWhereRaw('CAST(a.APPOINTMENT_DATE AS DATE) = ?', [dateValue])
        .andWhereRaw('CAST(a.APPOINTMENT_DATE AS TIME) = ?', [timeValue])
        .whereNot('a.APPOINTMENT_STATUS', 'Cancelled');
      if (excludeAppointmentId) {
        this.andWhereNot('a.APPOINTMENT_ID', excludeAppointmentId);
      }
    })
    .orderBy('e.EMPLOYEE_NAME', 'asc');
}

export async function getVetScheduleOverview({ branchId = null } = {}) {
  let query = db('VET_SCHEDULE as vs')
    .join('EMPLOYEE as e', 'vs.VET_ID', 'e.EMPLOYEE_ID')
    .join('BRANCH as b', 'vs.BRANCH_ID', 'b.BRANCH_ID')
    .select(
      'vs.VET_ID as vetId',
      'e.EMPLOYEE_NAME as vetName',
      'vs.BRANCH_ID as branchId',
      'b.BRANCH_NAME as branchName',
      'vs.DAY_OF_WEEK as dayOfWeek',
      'vs.START_TIME as startTime',
      'vs.END_TIME as endTime',
      'vs.SLOT_MINUTES as slotMinutes'
    )
    .where('e.EMPLOYEE_POSITION', 'VET');

  if (branchId) {
    query = query.where('vs.BRANCH_ID', branchId);
  }

  return query
    .orderBy('vs.BRANCH_ID', 'asc')
    .orderBy('e.EMPLOYEE_NAME', 'asc')
    .orderBy('vs.DAY_OF_WEEK', 'asc')
    .orderBy('vs.START_TIME', 'asc');
}

// Get all appointments with filters and pagination
export async function getAll({
  status = null,
  fromDate = null,
  toDate = null,
  q = '',
  page = 1,
  limit = 20
} = {}) {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (status) {
    const normalized = String(status).toLowerCase();
    const statusTokens = {
      pending: ['%pending%', '%cho%'],
      confirmed: ['%confirm%'],
      completed: ['%complete%', '%hoan%'],
      cancelled: ['%cancel%', '%huy%']
    }[normalized] || [`%${status}%`];
    const statusFilters = statusTokens.map(() => 'a.APPOINTMENT_STATUS COLLATE Latin1_General_CI_AI LIKE ?');
    filters.push(`(${statusFilters.join(' OR ')})`);
    params.push(...statusTokens);
  }
  if (fromDate) {
    filters.push('CONVERT(DATE, a.APPOINTMENT_DATE) >= CONVERT(DATE, ?)');
    params.push(fromDate);
  }
  if (toDate) {
    filters.push('CONVERT(DATE, a.APPOINTMENT_DATE) <= CONVERT(DATE, ?)');
    params.push(toDate);
  }
  if (q) {
    filters.push(`(
      cu.CUSTOMER_NAME COLLATE Latin1_General_CI_AI LIKE ?
      OR s.SERVICE_NAME COLLATE Latin1_General_CI_AI LIKE ?
      OR CAST(a.APPOINTMENT_ID AS NVARCHAR(20)) LIKE ?
    )`);
    const token = `%${q}%`;
    params.push(token, token, token);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const countResult = await db.raw(`
    SELECT COUNT(*) as count
    FROM APPOINTMENT a
    JOIN CUSTOMER cu ON a.CUSTOMER_ID = cu.CUSTOMER_ID
    JOIN BRANCH b ON a.BRANCH_ID = b.BRANCH_ID
    JOIN SERVICE s ON a.SERVICE_ID = s.SERVICE_ID
    LEFT JOIN EMPLOYEE e ON a.VET_ID = e.EMPLOYEE_ID
    ${whereClause}
  `, params);
  const total = countResult[0]?.count || 0;

  const dataParams = [...params, offset, limit];
  const appointments = await db.raw(`
    SELECT
      a.APPOINTMENT_ID as id,
      a.APPOINTMENT_DATE as date,
      a.APPOINTMENT_STATUS as status,
      cu.CUSTOMER_ID as customerId,
      cu.CUSTOMER_NAME as customerName,
      b.BRANCH_NAME as branchName,
      s.SERVICE_NAME as serviceName,
      e.EMPLOYEE_NAME as vetName
    FROM APPOINTMENT a
    JOIN CUSTOMER cu ON a.CUSTOMER_ID = cu.CUSTOMER_ID
    JOIN BRANCH b ON a.BRANCH_ID = b.BRANCH_ID
    JOIN SERVICE s ON a.SERVICE_ID = s.SERVICE_ID
    LEFT JOIN EMPLOYEE e ON a.VET_ID = e.EMPLOYEE_ID
    ${whereClause}
    ORDER BY a.APPOINTMENT_DATE DESC
    OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
  `, dataParams);

  return { appointments, total, page, limit };
}

export async function updateStatus({ appointmentId, status }) {
  await db('APPOINTMENT')
    .where('APPOINTMENT_ID', appointmentId)
    .update({ APPOINTMENT_STATUS: status });
}
