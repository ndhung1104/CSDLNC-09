import db from '../utils/db.js';

// Get all checkups with filters
export async function getAll({ vetId = null, status = null, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let query = db('CHECK_UP')
        .join('PET', 'CHECK_UP.PET_ID', 'PET.PET_ID')
        .join('CUSTOMER', 'PET.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
        .join('EMPLOYEE', 'CHECK_UP.VET_ID', 'EMPLOYEE.EMPLOYEE_ID')
        .select(
            'CHECK_UP.CHECK_UP_ID as id',
            'CHECK_UP.STATUS as status',
            'CHECK_UP.SYMPTOMS as symptoms',
            'CHECK_UP.DIAGNOSIS as diagnosis',
            'PET.PET_NAME as petName',
            'PET.PET_ID as petId',
            'CUSTOMER.CUSTOMER_NAME as customerName',
            'CUSTOMER.CUSTOMER_ID as customerId',
            'EMPLOYEE.EMPLOYEE_NAME as vetName'
        )
        .orderBy('CHECK_UP.CHECK_UP_ID', 'desc');

    if (vetId) query = query.where('CHECK_UP.VET_ID', vetId);
    if (status) query = query.where('CHECK_UP.STATUS', status);

    const total = await query.clone().count('* as count').first();
    const checkups = await query.offset(offset).limit(limit);
    return { checkups, total: total?.count || 0, page, limit };
}

// Get checkup by ID
export async function getById(id) {
    const checkup = await db('CHECK_UP')
        .join('PET', 'CHECK_UP.PET_ID', 'PET.PET_ID')
        .join('CUSTOMER', 'PET.CUSTOMER_ID', 'CUSTOMER.CUSTOMER_ID')
        .join('EMPLOYEE', 'CHECK_UP.VET_ID', 'EMPLOYEE.EMPLOYEE_ID')
        .select('CHECK_UP.*', 'PET.PET_NAME as petName', 'CUSTOMER.CUSTOMER_NAME as customerName',
            'EMPLOYEE.EMPLOYEE_NAME as vetName')
        .where('CHECK_UP.CHECK_UP_ID', id)
        .first();
    return checkup;
}

// Create checkup using stored procedure
// SP: uspCheckUpCreate(@PetId, @VetId, @MedicalServiceId, @CheckUpId OUTPUT)
export async function create({ petId, vetId, medicalServiceId = 1 }) {
    const result = await db.raw(`
    DECLARE @NewId INT;
    EXEC dbo.uspCheckUpCreate
      @PetId = ?,
      @VetId = ?,
      @MedicalServiceId = ?,
      @CheckUpId = @NewId OUTPUT;
    SELECT @NewId AS id;
  `, [petId, vetId, medicalServiceId]);
    return result[0]?.id || null;
}

// Update checkup notes using stored procedure
export async function updateNotes({ checkupId, symptoms, diagnosis, status }) {
    await db.raw(`EXEC dbo.uspCheckUpUpdateNotes @CheckUpId = ?, @Symptoms = ?, @Diagnosis = ?, @Status = ?`,
        [checkupId, symptoms, diagnosis, status]);
}

// Get vets for dropdown
export async function getVets(branchId = null) {
    let query = db('EMPLOYEE')
        .select('EMPLOYEE_ID as id', 'EMPLOYEE_NAME as name', 'BRANCH_ID as branchId')
        .where('EMPLOYEE_POSITION', 'VET');
    if (branchId) query = query.where('BRANCH_ID', branchId);
    return query;
}

// Get medical services for dropdown
export async function getMedicalServices() {
    return db('MEDICAL_SERVICE')
        .join('PRODUCT', 'MEDICAL_SERVICE.MEDICAL_SERVICE_ID', 'PRODUCT.PRODUCT_ID')
        .select('MEDICAL_SERVICE.MEDICAL_SERVICE_ID as id', 'PRODUCT.PRODUCT_NAME as name', 'MEDICAL_SERVICE.MEDICAL_SERVICE_FEE as fee');
}
