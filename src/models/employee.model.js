import db from '../utils/db.js';

export async function findByEmail(email) {
    return db('EMPLOYEE')
        .join('BRANCH', 'EMPLOYEE.BRANCH_ID', 'BRANCH.BRANCH_ID')
        .select(
            'EMPLOYEE.EMPLOYEE_ID as id',
            'EMPLOYEE.EMPLOYEE_NAME as name',
            'EMPLOYEE.EMPLOYEE_EMAIL as email',
            'EMPLOYEE.EMPLOYEE_PASSWORD as password',
            'EMPLOYEE.EMPLOYEE_POSITION as position',
            'EMPLOYEE.BRANCH_ID as branchId',
            'BRANCH.BRANCH_NAME as branchName'
        )
        .where('EMPLOYEE.EMPLOYEE_EMAIL', email)
        .first();
}
