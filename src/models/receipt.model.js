import db from '../utils/db.js';

function normalizeStatus(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function isDraftStatus(status) {
    const normalized = normalizeStatus(status);
    return normalized.includes('chua') || normalized.includes('cho') || normalized.includes('pending');
}

// Get all receipts - sorted by status (drafts first), then by date
export async function getAll({
    branchId = null,
    status = null,
    fromDate = null,
    toDate = null,
    q = '',
    page = 1,
    limit = 20,
    sort = 'status'
} = {}) {
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];
    if (branchId) {
        filters.push('r.BRANCH_ID = ?');
        params.push(branchId);
    }
    if (status) {
        const normalized = String(status).toLowerCase();
        const statusTokens = normalized === 'paid'
            ? ['%da%', '%paid%', '%thanh toan%']
            : normalized === 'unpaid'
                ? ['%cho%', '%pending%', '%chua%']
                : [`%${status}%`];
        const statusFilters = statusTokens.map(() => 'r.RECEIPT_STATUS COLLATE Latin1_General_CI_AI LIKE ?');
        filters.push(`(${statusFilters.join(' OR ')})`);
        params.push(...statusTokens);
    }
    if (fromDate) {
        filters.push('CONVERT(DATE, r.RECEIPT_CREATED_DATE) >= CONVERT(DATE, ?)');
        params.push(fromDate);
    }
    if (toDate) {
        filters.push('CONVERT(DATE, r.RECEIPT_CREATED_DATE) <= CONVERT(DATE, ?)');
        params.push(toDate);
    }
    if (q) {
        filters.push(`(
            c.CUSTOMER_NAME COLLATE Latin1_General_CI_AI LIKE ?
            OR c.CUSTOMER_PHONE LIKE ?
            OR c.CUSTOMER_EMAIL COLLATE Latin1_General_CI_AI LIKE ?
            OR CAST(r.RECEIPT_ID AS NVARCHAR(20)) LIKE ?
        )`);
        const token = `%${q}%`;
        params.push(token, token, token, token);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // Count query
    const countResult = await db.raw(`
        SELECT COUNT(*) as count
        FROM RECEIPT r
        LEFT JOIN CUSTOMER c ON r.CUSTOMER_ID = c.CUSTOMER_ID
        ${whereClause}
    `, params);
    const total = countResult[0]?.count || 0;

    // Build ORDER BY based on sort parameter
    let orderBy = '';
    switch (sort) {
        case 'id':
            orderBy = 'ORDER BY r.RECEIPT_ID DESC';
            break;
        case 'date':
            orderBy = 'ORDER BY r.RECEIPT_CREATED_DATE DESC';
            break;
        case 'status':
        default:
            // Drafts first, then by date
            orderBy = `ORDER BY 
                CASE WHEN r.RECEIPT_STATUS = N'Chờ thanh toán' THEN 0 ELSE 1 END,
                r.RECEIPT_CREATED_DATE DESC`;
            break;
    }

    // Data query with proper pagination
    const receipts = await db.raw(`
        SELECT 
            r.RECEIPT_ID as id,
            r.RECEIPT_STATUS as status,
            r.RECEIPT_TOTAL_PRICE as total,
            r.RECEIPT_CREATED_DATE as date,
            c.CUSTOMER_NAME as customerName,
            c.CUSTOMER_ID as customerId,
            b.BRANCH_NAME as branchName,
            e.EMPLOYEE_NAME as employeeName
        FROM RECEIPT r
        LEFT JOIN CUSTOMER c ON r.CUSTOMER_ID = c.CUSTOMER_ID
        LEFT JOIN BRANCH b ON r.BRANCH_ID = b.BRANCH_ID
        LEFT JOIN EMPLOYEE e ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
        ${whereClause}
        ${orderBy}
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `, params);

    return { receipts, total, page, limit };
}

// Get receipt by ID with details
export async function getById(id) {
    const result = await db.raw(`
        SELECT 
            r.*,
            c.CUSTOMER_NAME as customerName,
            b.BRANCH_NAME as branchName,
            e.EMPLOYEE_NAME as employeeName
        FROM RECEIPT r
        LEFT JOIN CUSTOMER c ON r.CUSTOMER_ID = c.CUSTOMER_ID
        LEFT JOIN BRANCH b ON r.BRANCH_ID = b.BRANCH_ID
        LEFT JOIN EMPLOYEE e ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
        WHERE r.RECEIPT_ID = ?
    `, [id]);

    const receipt = result[0];
    if (!receipt) return null;

    const details = await db.raw(`
        SELECT rd.*, p.PRODUCT_NAME as productName
        FROM RECEIPT_DETAIL rd
        JOIN PRODUCT p ON rd.PRODUCT_ID = p.PRODUCT_ID
        WHERE rd.RECEIPT_ID = ?
    `, [id]);

    return { ...receipt, details };
}

// Create draft receipt using stored procedure
export async function createDraft({ customerId, branchId, employeeId, paymentMethod = 'Cash' }) {
    const result = await db.raw(`
    DECLARE @NewId INT;
    EXEC dbo.uspReceiptCreateDraft
      @BranchId = ?,
      @CustomerId = ?,
      @ReceptionistId = ?,
      @PaymentMethod = ?,
      @ReceiptId = @NewId OUTPUT;
    SELECT @NewId AS id;
  `, [branchId, customerId, employeeId, paymentMethod]);
    return result[0]?.id || null;
}

// Add item to receipt (uses stored procedure for proper price calculation)
export async function addItem({ receiptId, productId, quantity, petId = null, price = null }) {
    const receipt = await db('RECEIPT')
        .select('RECEIPT_STATUS')
        .where('RECEIPT_ID', receiptId)
        .first();

    if (!receipt) {
        throw new Error('Receipt not found.');
    }
    if (!isDraftStatus(receipt.RECEIPT_STATUS)) {
        throw new Error('Receipt is already paid.');
    }

    // The stored procedure expects a table-valued parameter, but we'll use direct INSERT
    // Get the max item ID for this receipt
    const maxResult = await db.raw(`
        SELECT ISNULL(MAX(RECEIPT_ITEM_ID), 0) as maxId FROM RECEIPT_DETAIL
    `);
    const nextItemId = (maxResult[0]?.maxId || 0) + 1;

    // Get product price if not provided
    let unitPrice = price;
    if (unitPrice == null) {
        const priceResult = await db.raw(`
            SELECT SALES_PRODUCT_PRICE as price FROM SALES_PRODUCT WHERE SALES_PRODUCT_ID = ?
        `, [productId]);
        unitPrice = priceResult[0]?.price;
    }
    if (unitPrice == null) {
        const serviceResult = await db.raw(`
            SELECT MEDICAL_SERVICE_FEE as price FROM MEDICAL_SERVICE WHERE MEDICAL_SERVICE_ID = ?
        `, [productId]);
        unitPrice = serviceResult[0]?.price;
    }
    if (unitPrice == null) {
        const planResult = await db.raw(`
            SELECT VACCINATION_PLAN_PRICE as price FROM VACCINATION_PLAN WHERE VACCINATION_PLAN_ID = ?
        `, [productId]);
        unitPrice = planResult[0]?.price;
    }
    if (unitPrice == null) {
        const vaccineResult = await db.raw(`
            SELECT VACCINE_PRICE as price FROM VACCINE WHERE VACCINE_ID = ?
        `, [productId]);
        unitPrice = vaccineResult[0]?.price;
    }
    if (unitPrice == null) {
        unitPrice = 0;
    }

    // Insert the item
    await db.raw(`
        INSERT INTO RECEIPT_DETAIL (RECEIPT_ITEM_ID, RECEIPT_ID, PRODUCT_ID, PET_ID, RECEIPT_ITEM_AMOUNT, RECEIPT_ITEM_PRICE)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [nextItemId, receiptId, productId, petId, quantity, unitPrice]);

    // Recalculate total
    await db.raw(`
        UPDATE RECEIPT
        SET RECEIPT_TOTAL_PRICE = (
            SELECT ISNULL(SUM(RECEIPT_ITEM_AMOUNT * RECEIPT_ITEM_PRICE), 0)
            FROM RECEIPT_DETAIL WHERE RECEIPT_ID = ?
        )
        WHERE RECEIPT_ID = ?
    `, [receiptId, receiptId]);

    return nextItemId;
}

// Remove item from receipt
export async function removeItem({ receiptId, itemId }) {
    const receipt = await db('RECEIPT')
        .select('RECEIPT_STATUS')
        .where('RECEIPT_ID', receiptId)
        .first();

    if (!receipt) {
        throw new Error('Receipt not found.');
    }
    if (!isDraftStatus(receipt.RECEIPT_STATUS)) {
        throw new Error('Receipt is already paid.');
    }

    // Delete the item
    await db.raw(`
        DELETE FROM RECEIPT_DETAIL WHERE RECEIPT_ID = ? AND RECEIPT_ITEM_ID = ?
    `, [receiptId, itemId]);

    // Recalculate total
    await db.raw(`
        UPDATE RECEIPT
        SET RECEIPT_TOTAL_PRICE = (
            SELECT ISNULL(SUM(RECEIPT_ITEM_AMOUNT * RECEIPT_ITEM_PRICE), 0)
            FROM RECEIPT_DETAIL WHERE RECEIPT_ID = ?
        )
        WHERE RECEIPT_ID = ?
    `, [receiptId, receiptId]);
}

// Get latest draft receipt for a customer
export async function getDraftByCustomer(customerId) {
    const result = await db.raw(`
        SELECT TOP 1
            r.RECEIPT_ID as id,
            r.RECEIPT_STATUS as status,
            r.RECEIPT_CREATED_DATE as createdDate,
            r.RECEIPT_TOTAL_PRICE as total,
            r.BRANCH_ID as branchId
        FROM RECEIPT r
        WHERE r.CUSTOMER_ID = ?
          AND (
            r.RECEIPT_STATUS COLLATE Latin1_General_CI_AI LIKE '%cho%'
            OR r.RECEIPT_STATUS COLLATE Latin1_General_CI_AI LIKE '%chua%'
            OR r.RECEIPT_STATUS COLLATE Latin1_General_CI_AI LIKE '%pending%'
          )
        ORDER BY r.RECEIPT_CREATED_DATE DESC
    `, [customerId]);
    return result[0] || null;
}

// Get a receipt item for updates
export async function getReceiptItem({ receiptId, itemId }) {
    return db('RECEIPT_DETAIL')
        .select(
            'RECEIPT_ITEM_ID as itemId',
            'RECEIPT_ID as receiptId',
            'PRODUCT_ID as productId',
            'RECEIPT_ITEM_AMOUNT as quantity'
        )
        .where('RECEIPT_ID', receiptId)
        .where('RECEIPT_ITEM_ID', itemId)
        .first();
}

export async function getReceiptItemByProduct({ receiptId, productId }) {
    return db('RECEIPT_DETAIL')
        .select(
            'RECEIPT_ITEM_ID as itemId',
            'RECEIPT_ID as receiptId',
            'PRODUCT_ID as productId',
            'RECEIPT_ITEM_AMOUNT as quantity'
        )
        .where('RECEIPT_ID', receiptId)
        .where('PRODUCT_ID', productId)
        .first();
}

// Update receipt item quantity and recalc total
export async function updateItemQuantity({ receiptId, itemId, quantity }) {
    const receipt = await db('RECEIPT')
        .select('RECEIPT_STATUS')
        .where('RECEIPT_ID', receiptId)
        .first();

    if (!receipt) {
        throw new Error('Receipt not found.');
    }
    if (!isDraftStatus(receipt.RECEIPT_STATUS)) {
        throw new Error('Receipt is already paid.');
    }

    await db.raw(`
        UPDATE RECEIPT_DETAIL
        SET RECEIPT_ITEM_AMOUNT = ?
        WHERE RECEIPT_ID = ? AND RECEIPT_ITEM_ID = ?
    `, [quantity, receiptId, itemId]);

    await db.raw(`
        UPDATE RECEIPT
        SET RECEIPT_TOTAL_PRICE = (
            SELECT ISNULL(SUM(RECEIPT_ITEM_AMOUNT * RECEIPT_ITEM_PRICE), 0)
            FROM RECEIPT_DETAIL WHERE RECEIPT_ID = ?
        )
        WHERE RECEIPT_ID = ?
    `, [receiptId, receiptId]);
}

// Complete receipt and accumulate points using stored procedure
export async function complete(receiptId) {
    await db.raw(`EXEC dbo.uspReceiptMarkCompletedAndAccumulate @ReceiptId = ?`, [receiptId]);
}

// Get products for item picker (sales products only)
export async function getProducts({ search = '', branchId = null } = {}) {
    let query = `
        SELECT 
            sp.SALES_PRODUCT_ID as id,
            p.PRODUCT_NAME as name,
            sp.SALES_PRODUCT_PRICE as price,
            'product' as type
        FROM SALES_PRODUCT sp
        JOIN PRODUCT p ON sp.SALES_PRODUCT_ID = p.PRODUCT_ID
    `;

    if (search) {
        query += ` WHERE p.PRODUCT_NAME LIKE '%${search}%'`;
    }

    query += ` ORDER BY p.PRODUCT_NAME`;

    return db.raw(query);
}

// Get medical services for item picker
export async function getServices() {
    return db.raw(`
        SELECT 
            ms.MEDICAL_SERVICE_ID as id,
            p.PRODUCT_NAME as name,
            ms.MEDICAL_SERVICE_FEE as price,
            'service' as type
        FROM MEDICAL_SERVICE ms
        JOIN PRODUCT p ON ms.MEDICAL_SERVICE_ID = p.PRODUCT_ID
        ORDER BY p.PRODUCT_NAME
    `);
}

// Get vaccination plans for item picker
export async function getVaccinationPlans() {
    return db.raw(`
        SELECT 
            vp.VACCINATION_PLAN_ID as id,
            p.PRODUCT_NAME as name,
            vp.VACCINATION_PLAN_DURATION as duration,
            vp.VACCINATION_PLAN_PRICE as price,
            'plan' as type
        FROM VACCINATION_PLAN vp
        JOIN PRODUCT p ON vp.VACCINATION_PLAN_ID = p.PRODUCT_ID
        ORDER BY p.PRODUCT_NAME
    `);
}

// Get vaccination plan by ID
export async function getVaccinationPlanById(planId) {
    const result = await db.raw(`
        SELECT 
            vp.VACCINATION_PLAN_ID as id,
            vp.VACCINATION_PLAN_DURATION as duration,
            vp.VACCINATION_PLAN_PRICE as price
        FROM VACCINATION_PLAN vp
        WHERE vp.VACCINATION_PLAN_ID = ?
    `, [planId]);
    return result[0] || null;
}

// Get minimal receipt info for item operations
export async function getReceiptInfo(receiptId) {
    return db('RECEIPT')
        .select('CUSTOMER_ID as customerId', 'RECEIPT_STATUS as status', 'BRANCH_ID as branchId')
        .where('RECEIPT_ID', receiptId)
        .first();
}

// Get vaccines for item picker
export async function getVaccines() {
    return db.raw(`
        SELECT 
            v.VACCINE_ID as id,
            p.PRODUCT_NAME as name,
            v.VACCINE_PRICE as price,
            'vaccine' as type
        FROM VACCINE v
        JOIN PRODUCT p ON v.VACCINE_ID = p.PRODUCT_ID
        ORDER BY p.PRODUCT_NAME
    `);
}

export async function isVaccineProduct(productId) {
    const result = await db.raw(`
        SELECT 1 as found
        FROM VACCINE
        WHERE VACCINE_ID = ?
    `, [productId]);

    return !!result[0];
}

export async function getVaccinationById(vaccinationId) {
    const result = await db.raw(`
        SELECT 
            v.VACCINATION_ID as vaccinationId,
            v.MEDICAL_SERVICE as medicalServiceId,
            ms.MEDICAL_SERVICE_FEE as medicalServiceFee,
            p.PRODUCT_NAME as medicalServiceName,
            v.PET_ID as petId,
            pet.PET_NAME as petName,
            pet.CUSTOMER_ID as customerId,
            v.PET_VACCINATION_PLAN_ID as petVaccinationPlanId,
            vb.BRANCH_ID as branchId,
            vac.VACCINE_ID as vaccineId,
            vp.PRODUCT_NAME as vaccineName,
            vac.VACCINE_PRICE as vaccinePrice
        FROM VACCINATION v
        JOIN MEDICAL_SERVICE ms ON v.MEDICAL_SERVICE = ms.MEDICAL_SERVICE_ID
        JOIN PRODUCT p ON ms.MEDICAL_SERVICE_ID = p.PRODUCT_ID
        JOIN BRANCH_VACCINE_BATCH vb ON v.VACCINE_BATCH_ID = vb.VACCINE_BATCH_ID
        JOIN VACCINE vac ON vb.VACCINE_ID = vac.VACCINE_ID
        JOIN PRODUCT vp ON vac.VACCINE_ID = vp.PRODUCT_ID
        JOIN PET pet ON v.PET_ID = pet.PET_ID
        WHERE v.VACCINATION_ID = ?
    `, [vaccinationId]);

    return result[0] || null;
}

// Add vaccination plan item to receipt and create pet plan record
export async function addVaccinationPlanItem({ receiptId, planId, petId, customerId }) {
    return db.transaction(async (trx) => {
        const receipt = await trx('RECEIPT')
            .select('RECEIPT_STATUS')
            .where('RECEIPT_ID', receiptId)
            .first();

        if (!receipt) {
            throw new Error('Receipt not found.');
        }
        if (!isDraftStatus(receipt.RECEIPT_STATUS)) {
            throw new Error('Receipt is already paid.');
        }

        const priceResult = await trx.raw(`
            SELECT CAST(
                vp.VACCINATION_PLAN_PRICE * (1 - dbo.fnGetMembershipDiscountPercent(c.MEMBERSHIP_RANK_ID))
                AS DECIMAL(18,0)
            ) as price
            FROM VACCINATION_PLAN vp
            JOIN CUSTOMER c ON c.CUSTOMER_ID = ?
            WHERE vp.VACCINATION_PLAN_ID = ?
        `, [customerId, planId]);

        const unitPrice = priceResult[0]?.price;
        if (unitPrice == null) {
            throw new Error('Vaccination plan not found.');
        }

        await trx.raw(`
            DECLARE @NewId INT;
            EXEC dbo.uspPetVaccinationPlanCreate
                @PetId = ?,
                @VaccinationPlanId = ?,
                @PlanStartDate = ?,
                @PetVaccinationPlanId = @NewId OUTPUT;
            SELECT @NewId AS id;
        `, [petId, planId, new Date()]);

        const maxResult = await trx.raw(`
            SELECT ISNULL(MAX(RECEIPT_ITEM_ID), 0) as maxId FROM RECEIPT_DETAIL
        `);
        const nextItemId = (maxResult[0]?.maxId || 0) + 1;

        await trx.raw(`
            INSERT INTO RECEIPT_DETAIL (RECEIPT_ITEM_ID, RECEIPT_ID, PRODUCT_ID, PET_ID, RECEIPT_ITEM_AMOUNT, RECEIPT_ITEM_PRICE)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [nextItemId, receiptId, planId, petId, 1, unitPrice]);

        await trx.raw(`
            UPDATE RECEIPT
            SET RECEIPT_TOTAL_PRICE = (
                SELECT ISNULL(SUM(RECEIPT_ITEM_AMOUNT * RECEIPT_ITEM_PRICE), 0)
                FROM RECEIPT_DETAIL WHERE RECEIPT_ID = ?
            )
            WHERE RECEIPT_ID = ?
        `, [receiptId, receiptId]);

        return nextItemId;
    });
}

// Get branches for dropdown
export async function getBranches() {
    return db.raw('SELECT BRANCH_ID as id, BRANCH_NAME as name FROM BRANCH');
}

// Get receipts for a specific customer with details
export async function getByCustomerId(customerId) {
    const receipts = await db('RECEIPT as r')
        .leftJoin('BRANCH as b', 'r.BRANCH_ID', 'b.BRANCH_ID')
        .select(
            'r.RECEIPT_ID as id',
            'r.RECEIPT_STATUS as status',
            'r.RECEIPT_TOTAL_PRICE as total',
            'r.RECEIPT_CREATED_DATE as date',
            'b.BRANCH_NAME as branchName',
            'r.RECEIPT_PAYMENT_METHOD as paymentMethod'
        )
        .where('r.CUSTOMER_ID', customerId)
        .orderBy('r.RECEIPT_CREATED_DATE', 'desc');

    if (receipts.length === 0) return [];

    const receiptIds = receipts.map(r => r.id);
    const details = await db('RECEIPT_DETAIL as rd')
        .join('PRODUCT as p', 'rd.PRODUCT_ID', 'p.PRODUCT_ID')
        .select(
            'rd.RECEIPT_ID as receiptId',
            'p.PRODUCT_NAME as productName',
            'rd.RECEIPT_ITEM_AMOUNT as quantity',
            'rd.RECEIPT_ITEM_PRICE as price'
        )
        .whereIn('rd.RECEIPT_ID', receiptIds);

    const detailMap = {};
    details.forEach(d => {
        if (!detailMap[d.receiptId]) detailMap[d.receiptId] = [];
        detailMap[d.receiptId].push({
            itemName: d.productName,
            quantity: d.quantity,
            totalPrice: d.price * d.quantity
        });
    });

    receipts.forEach(r => {
        r.items = detailMap[r.id] || [];
    });

    return receipts;
}

// Get receipts with items for a specific pet and customer
export async function getByPetIdForCustomer({ petId, customerId }) {
    const rows = await db('RECEIPT_DETAIL as rd')
        .join('RECEIPT as r', 'rd.RECEIPT_ID', 'r.RECEIPT_ID')
        .join('PRODUCT as p', 'rd.PRODUCT_ID', 'p.PRODUCT_ID')
        .leftJoin('BRANCH as b', 'r.BRANCH_ID', 'b.BRANCH_ID')
        .select(
            'r.RECEIPT_ID as id',
            'r.RECEIPT_STATUS as status',
            'r.RECEIPT_TOTAL_PRICE as total',
            'r.RECEIPT_CREATED_DATE as date',
            'r.RECEIPT_PAYMENT_METHOD as paymentMethod',
            'b.BRANCH_NAME as branchName',
            'rd.RECEIPT_ITEM_ID as itemId',
            'rd.RECEIPT_ITEM_AMOUNT as quantity',
            'rd.RECEIPT_ITEM_PRICE as price',
            'p.PRODUCT_NAME as productName'
        )
        .where('rd.PET_ID', petId)
        .andWhere('r.CUSTOMER_ID', customerId)
        .orderBy('r.RECEIPT_CREATED_DATE', 'desc')
        .orderBy('rd.RECEIPT_ITEM_ID', 'asc');

    if (rows.length === 0) return [];

    const receipts = [];
    const receiptMap = {};

    rows.forEach(row => {
        if (!receiptMap[row.id]) {
            receiptMap[row.id] = {
                id: row.id,
                status: row.status,
                total: row.total,
                date: row.date,
                paymentMethod: row.paymentMethod,
                branchName: row.branchName,
                items: []
            };
            receipts.push(receiptMap[row.id]);
        }
        receiptMap[row.id].items.push({
            itemName: row.productName,
            quantity: row.quantity,
            price: row.price
        });
    });

    return receipts;
}

