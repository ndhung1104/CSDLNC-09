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
