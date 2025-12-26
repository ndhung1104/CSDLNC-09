import db from '../utils/db.js';

// Get all checkups with filters (using raw SQL with TOP for reliability)
export async function getAll({
    vetId = null,
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
    if (vetId != null) {
        filters.push('c.VET_ID = ?');
        params.push(vetId);
    }
    if (status) {
        const normalized = String(status).toLowerCase();
        const statusTokens = {
            pending: ['%cho%', '%pending%'],
            in_progress: ['%dang%', '%progress%'],
            completed: ['%hoan%', '%complete%']
        }[normalized] || [`%${status}%`];
        const statusFilters = statusTokens.map(() => 'c.STATUS COLLATE Latin1_General_CI_AI LIKE ?');
        filters.push(`(${statusFilters.join(' OR ')})`);
        params.push(...statusTokens);
    }
    if (fromDate) {
        filters.push('CONVERT(DATE, c.FOLLOW_UP_VISIT) >= CONVERT(DATE, ?)');
        params.push(fromDate);
    }
    if (toDate) {
        filters.push('CONVERT(DATE, c.FOLLOW_UP_VISIT) <= CONVERT(DATE, ?)');
        params.push(toDate);
    }
    if (q) {
        filters.push('(p.PET_NAME COLLATE Latin1_General_CI_AI LIKE ? OR cu.CUSTOMER_NAME COLLATE Latin1_General_CI_AI LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // Count query
    const countResult = await db.raw(`
        SELECT COUNT(*) as count
        FROM CHECK_UP c
        JOIN PET p ON c.PET_ID = p.PET_ID
        JOIN CUSTOMER cu ON p.CUSTOMER_ID = cu.CUSTOMER_ID
        ${whereClause}
    `, params);
    const total = countResult[0]?.count || 0;

    // Data query with pagination
    const dataParams = [...params, offset, limit];
    const checkups = await db.raw(`
        SELECT
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
        ${whereClause}
        ORDER BY c.CHECK_UP_ID DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, dataParams);

    return { checkups, total, page, limit };
}

// Get checkup by ID
export async function getById(id) {
    const result = await db.raw(`
        SELECT 
            c.*,
            p.PET_NAME as petName,
            cu.CUSTOMER_NAME as customerName,
            e.EMPLOYEE_NAME as vetName,
            b.BRANCH_NAME as branchName,
            b.BRANCH_ID as branchId
        FROM CHECK_UP c
        JOIN PET p ON c.PET_ID = p.PET_ID
        JOIN CUSTOMER cu ON p.CUSTOMER_ID = cu.CUSTOMER_ID
        LEFT JOIN EMPLOYEE e ON c.VET_ID = e.EMPLOYEE_ID
        LEFT JOIN BRANCH b ON e.BRANCH_ID = b.BRANCH_ID
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
    const id = result[0]?.id || null;
    if (id) {
        await db.raw(`
            UPDATE CHECK_UP
            SET FOLLOW_UP_VISIT = ISNULL(FOLLOW_UP_VISIT, GETDATE())
            WHERE CHECK_UP_ID = ?
        `, [id]);
    }
    return id;
}

// Update checkup notes using stored procedure
export async function updateNotes({ checkupId, symptoms, diagnosis, followUpVisit, status }) {
    await db.raw(
        `EXEC dbo.uspCheckUpUpdateNotes @CheckUpId = ?, @Symptoms = ?, @Diagnosis = ?, @FollowUpVisit = ?, @Status = ?`,
        [checkupId, symptoms, diagnosis, followUpVisit, status]
    );
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

// Get checkups for a customer's pets
export async function getByCustomerId(customerId) {
    return db('CHECK_UP as c')
        .join('PET as p', 'c.PET_ID', 'p.PET_ID')
        .join('CUSTOMER as cu', 'p.CUSTOMER_ID', 'cu.CUSTOMER_ID')
        .leftJoin('EMPLOYEE as e', 'c.VET_ID', 'e.EMPLOYEE_ID')
        .leftJoin('BRANCH as b', 'e.BRANCH_ID', 'b.BRANCH_ID')
        .select(
            'c.CHECK_UP_ID as id',
            'c.STATUS as status',
            'c.SYMPTOMS as symptoms',
            'c.DIAGNOSIS as diagnosis',
            'c.FOLLOW_UP_VISIT as date',
            'p.PET_NAME as petName',
            'p.PET_ID as petId',
            'cu.CUSTOMER_NAME as customerName',
            'cu.CUSTOMER_ID as customerId',
            'e.EMPLOYEE_NAME as vetName',
            'b.BRANCH_NAME as branchName'
        )
        .where('cu.CUSTOMER_ID', customerId)
        .orderBy('c.CHECK_UP_ID', 'desc');
}

// Get checkups for a specific pet
export async function getByPetId(petId) {
    return db('CHECK_UP as c')
        .join('PET as p', 'c.PET_ID', 'p.PET_ID')
        .join('CUSTOMER as cu', 'p.CUSTOMER_ID', 'cu.CUSTOMER_ID')
        .leftJoin('EMPLOYEE as e', 'c.VET_ID', 'e.EMPLOYEE_ID')
        .select(
            'c.CHECK_UP_ID as id',
            'c.STATUS as status',
            'c.SYMPTOMS as symptoms',
            'c.DIAGNOSIS as diagnosis',
            'c.FOLLOW_UP_VISIT as date',
            'p.PET_NAME as petName',
            'cu.CUSTOMER_NAME as customerName',
            'cu.CUSTOMER_ID as customerId',
            'e.EMPLOYEE_NAME as vetName'
        )
        .where('c.PET_ID', petId)
        .orderBy('c.CHECK_UP_ID', 'desc');
}

export async function getPrescriptionItems(checkupId) {
    return db('PRESCRIPTION_DETAIL as pd')
        .join('PRODUCT as p', 'pd.PRODUCT_ID', 'p.PRODUCT_ID')
        .leftJoin('SALES_PRODUCT as sp', 'pd.PRODUCT_ID', 'sp.SALES_PRODUCT_ID')
        .select(
            'pd.PRESCRIPTION_NUMBER as number',
            'pd.PRODUCT_ID as productId',
            'p.PRODUCT_NAME as productName',
            'pd.QUANTITY as quantity',
            'sp.SALES_PRODUCT_PRICE as price'
        )
        .where('pd.CHECK_UP_ID', checkupId)
        .orderBy('pd.PRESCRIPTION_NUMBER', 'asc');
}

export async function replacePrescriptionItems({ checkupId, items }) {
    return db.transaction(async trx => {
        const exists = await trx('CHECK_UP')
            .where('CHECK_UP_ID', checkupId)
            .first();
        if (!exists) {
            throw new Error('Check up not found.');
        }

        await trx('PRESCRIPTION_DETAIL')
            .where('CHECK_UP_ID', checkupId)
            .del();

        if (items && items.length > 0) {
            const rows = items.map((item, idx) => ({
                CHECK_UP_ID: checkupId,
                PRESCRIPTION_NUMBER: idx + 1,
                PRODUCT_ID: item.productId,
                QUANTITY: item.quantity
            }));
            await trx('PRESCRIPTION_DETAIL').insert(rows);
        }

        await trx('CHECK_UP')
            .where('CHECK_UP_ID', checkupId)
            .update({ PRESCRIPTION_AVAILABLE: items && items.length > 0 ? 1 : 0 });
    });
}
