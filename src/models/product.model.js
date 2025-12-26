import db from '../utils/db.js';

// Get all sales products with search and pagination - SALES_PRODUCT joins PRODUCT
export async function getAll({ search = '', branchId = null, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    let countQuery = db('SALES_PRODUCT')
        .join('PRODUCT', 'SALES_PRODUCT.SALES_PRODUCT_ID', 'PRODUCT.PRODUCT_ID');

    let dataQuery = db('SALES_PRODUCT')
        .join('PRODUCT', 'SALES_PRODUCT.SALES_PRODUCT_ID', 'PRODUCT.PRODUCT_ID')
        .select(
            'SALES_PRODUCT.SALES_PRODUCT_ID as id',
            'PRODUCT.PRODUCT_NAME as name',
            'SALES_PRODUCT.SALES_PRODUCT_PRICE as price'
        );

    if (search) {
        const searchCondition = function () {
            this.where('PRODUCT.PRODUCT_NAME', 'like', `%${search}%`);
        };
        countQuery = countQuery.where(searchCondition);
        dataQuery = dataQuery.where(searchCondition);
    }

    const total = await countQuery.count('* as count').first();
    const products = await dataQuery
        .orderBy('SALES_PRODUCT.SALES_PRODUCT_ID', 'asc')
        .offset(offset)
        .limit(limit);

    // Get stock for each product at branch if branchId provided
    if (branchId && products.length > 0) {
        const productIds = products.map(p => p.id);
        const stocks = await db('BRANCH_STOCK')
            .select('SALES_PRODUCT_ID', 'QUANTITY')
            .where('BRANCH_ID', branchId)
            .whereIn('SALES_PRODUCT_ID', productIds);

        const stockMap = {};
        stocks.forEach(s => stockMap[s.SALES_PRODUCT_ID] = s.QUANTITY);
        products.forEach(p => p.stock = stockMap[p.id] || 0);
    }

    return { products, total: total?.count || 0, page, limit };
}

// Get medicines with optional search (avoid hard-coded PRODUCT_ID ranges)
export async function getMedicines({ search = '', branchId = null, page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const prescriptionProducts = db('PRESCRIPTION_DETAIL')
        .select('PRODUCT_ID')
        .whereNotIn('PRODUCT_ID', db('VACCINATION_PLAN').select('VACCINATION_PLAN_ID'));
    const medicineFilter = function () {
        this.whereRaw('PRODUCT.PRODUCT_NAME COLLATE Latin1_General_CI_AI LIKE ?', ['Thuoc%'])
            .orWhereIn('PRODUCT.PRODUCT_ID', prescriptionProducts);
    };

    let countQuery = db('SALES_PRODUCT')
        .join('PRODUCT', 'SALES_PRODUCT.SALES_PRODUCT_ID', 'PRODUCT.PRODUCT_ID')
        .where(medicineFilter);

    let dataQuery = db('SALES_PRODUCT')
        .join('PRODUCT', 'SALES_PRODUCT.SALES_PRODUCT_ID', 'PRODUCT.PRODUCT_ID')
        .select(
            'SALES_PRODUCT.SALES_PRODUCT_ID as id',
            'PRODUCT.PRODUCT_NAME as name',
            'SALES_PRODUCT.SALES_PRODUCT_PRICE as price'
        )
        .where(medicineFilter);

    if (search) {
        const searchCondition = function () {
            this.where('PRODUCT.PRODUCT_NAME', 'like', `%${search}%`);
        };
        countQuery = countQuery.where(searchCondition);
        dataQuery = dataQuery.where(searchCondition);
    }

    const total = await countQuery.count('* as count').first();
    const products = await dataQuery
        .orderBy('SALES_PRODUCT.SALES_PRODUCT_ID', 'asc')
        .offset(offset)
        .limit(limit);

    if (branchId && products.length > 0) {
        const productIds = products.map(p => p.id);
        const stocks = await db('BRANCH_STOCK')
            .select('SALES_PRODUCT_ID', 'QUANTITY')
            .where('BRANCH_ID', branchId)
            .whereIn('SALES_PRODUCT_ID', productIds);

        const stockMap = {};
        stocks.forEach(s => stockMap[s.SALES_PRODUCT_ID] = s.QUANTITY);
        products.forEach(p => p.stock = stockMap[p.id] || 0);
    }

    return { products, total: total?.count || 0, page, limit };
}

// Get vaccination plans with optional search
export async function getVaccinationPlans({ search = '', page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;

    let countQuery = db('VACCINATION_PLAN')
        .join('PRODUCT', 'VACCINATION_PLAN.VACCINATION_PLAN_ID', 'PRODUCT.PRODUCT_ID');

    let dataQuery = db('VACCINATION_PLAN')
        .join('PRODUCT', 'VACCINATION_PLAN.VACCINATION_PLAN_ID', 'PRODUCT.PRODUCT_ID')
        .select(
            'VACCINATION_PLAN.VACCINATION_PLAN_ID as id',
            'PRODUCT.PRODUCT_NAME as name',
            'VACCINATION_PLAN.VACCINATION_PLAN_DURATION as duration',
            'VACCINATION_PLAN.VACCINATION_PLAN_PRICE as price'
        );

    if (search) {
        const searchCondition = function () {
            this.where('PRODUCT.PRODUCT_NAME', 'like', `%${search}%`);
        };
        countQuery = countQuery.where(searchCondition);
        dataQuery = dataQuery.where(searchCondition);
    }

    const total = await countQuery.count('* as count').first();
    const plans = await dataQuery
        .orderBy('PRODUCT.PRODUCT_NAME', 'asc')
        .offset(offset)
        .limit(limit);

    return { plans, total: total?.count || 0, page, limit };
}

// Get product by ID with stock at all branches
export async function getById(id) {
    const product = await db('SALES_PRODUCT')
        .join('PRODUCT', 'SALES_PRODUCT.SALES_PRODUCT_ID', 'PRODUCT.PRODUCT_ID')
        .select(
            'SALES_PRODUCT.SALES_PRODUCT_ID as id',
            'PRODUCT.PRODUCT_NAME as name',
            'SALES_PRODUCT.SALES_PRODUCT_PRICE as price'
        )
        .where('SALES_PRODUCT.SALES_PRODUCT_ID', id)
        .first();

    if (!product) return null;

    const stocks = await db('BRANCH_STOCK')
        .join('BRANCH', 'BRANCH_STOCK.BRANCH_ID', 'BRANCH.BRANCH_ID')
        .select('BRANCH.BRANCH_NAME as branchName', 'BRANCH_STOCK.QUANTITY as quantity', 'BRANCH.BRANCH_ID as branchId')
        .where('BRANCH_STOCK.SALES_PRODUCT_ID', id);

    return { ...product, stocks };
}

// Get stock quantity for a sales product at a branch
export async function getBranchStock({ productId, branchId }) {
    const result = await db('BRANCH_STOCK')
        .select('QUANTITY as quantity')
        .where('BRANCH_ID', branchId)
        .where('SALES_PRODUCT_ID', productId)
        .first();
    return result?.quantity ?? null;
}

// Retail purchase - Use Case 4
// Use stored procedure with a table variable to keep spending updates centralized.
export async function purchase({ productId, quantity, customerId, branchId, employeeId, paymentMethod = 'Cash' }) {
    const result = await db.raw(`
        DECLARE @Items dbo.ReceiptItemType;
        INSERT INTO @Items (ProductId, PetId, Quantity, Price)
        VALUES (?, NULL, ?, NULL);

        DECLARE @NewReceiptId INT;
        EXEC dbo.uspRetailPurchaseWithStockCheck
            @BranchId = ?,
            @CustomerId = ?,
            @ReceptionistId = ?,
            @PaymentMethod = ?,
            @Items = @Items,
            @ReceiptId = @NewReceiptId OUTPUT;
        SELECT @NewReceiptId AS id;
    `, [productId, quantity, branchId, customerId, employeeId, paymentMethod]);

    return result[0]?.id || null;
}

