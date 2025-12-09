import db from '../utils/db.js';

// Get all checkups with filters (using raw SQL with TOP for reliability)
export async function getAll({ vetId = null, status = null, page = 1, limit = 20 } = {}) {
    // Count query
    const countResult = await db.raw('SELECT COUNT(*) as count FROM CHECK_UP');
    const total = countResult[0]?.count || 0;

    // Data query using raw SQL with TOP (simpler for SQL Server)
    const checkups = await db.raw(`
        SELECT TOP (${limit})
            c.CHECK_UP_ID as id,
            c.STATUS as status,
            c.SYMPTOMS as symptoms,
            c.DIAGNOSIS as diagnosis,
            c.FOLLOW_UP_VISIT as date,
            p.PET_NAME as petName,
            p.PET_ID as petId,
            cu.CUSTOMER_NAME as customerName,
            cu.CUSTOMER_ID as customerId,
            e.EMPLOYEE_NAME as vetName
        FROM CHECK_UP c
        JOIN PET p ON c.PET_ID = p.PET_ID
        JOIN CUSTOMER cu ON p.CUSTOMER_ID = cu.CUSTOMER_ID
        LEFT JOIN EMPLOYEE e ON c.VET_ID = e.EMPLOYEE_ID
        ORDER BY c.CHECK_UP_ID DESC
    `);

    return { checkups, total, page, limit };
}

// Get checkup by ID
export async function getById(id) {
    const result = await db.raw(`
        SELECT 
            c.*,
            p.PET_NAME as petName,
            cu.CUSTOMER_NAME as customerName,
            e.EMPLOYEE_NAME as vetName
        FROM CHECK_UP c
        JOIN PET p ON c.PET_ID = p.PET_ID
        JOIN CUSTOMER cu ON p.CUSTOMER_ID = cu.CUSTOMER_ID
        LEFT JOIN EMPLOYEE e ON c.VET_ID = e.EMPLOYEE_ID
        WHERE c.CHECK_UP_ID = ?
    `, [id]);
    return result[0] || null;
}

// Create checkup using stored procedure
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
    if (branchId) {
        return db.raw('SELECT EMPLOYEE_ID as id, EMPLOYEE_NAME as name, BRANCH_ID as branchId FROM EMPLOYEE WHERE EMPLOYEE_POSITION = ? AND BRANCH_ID = ?', ['VET', branchId]);
    }
    return db.raw('SELECT EMPLOYEE_ID as id, EMPLOYEE_NAME as name, BRANCH_ID as branchId FROM EMPLOYEE WHERE EMPLOYEE_POSITION = ?', ['VET']);
}

// Get medical services for dropdown
export async function getMedicalServices() {
    return db.raw(`
        SELECT m.MEDICAL_SERVICE_ID as id, p.PRODUCT_NAME as name, m.MEDICAL_SERVICE_FEE as fee
        FROM MEDICAL_SERVICE m
        JOIN PRODUCT p ON m.MEDICAL_SERVICE_ID = p.PRODUCT_ID
    `);
}
