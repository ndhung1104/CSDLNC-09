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
    const medicineFilter = function () {
        this.whereRaw('PRODUCT.PRODUCT_NAME COLLATE Latin1_General_CI_AI LIKE ?', ['Thuoc%'])
            .orWhereIn('PRODUCT.PRODUCT_ID', db('PRESCRIPTION_DETAIL').select('PRODUCT_ID'));
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

// Retail purchase - Use Case 4
// Since uspRetailPurchaseWithStockCheck uses table-valued parameter, we use direct SQL transaction
export async function purchase({ productId, quantity, customerId, branchId, employeeId, paymentMethod = 'Cash' }) {
    // Use a transaction to: check stock, create receipt, add item, deduct stock
    return db.transaction(async trx => {
        // Check stock
        const stock = await trx('BRANCH_STOCK')
            .where({ BRANCH_ID: branchId, SALES_PRODUCT_ID: productId })
            .first();

        if (!stock || stock.QUANTITY < quantity) {
            throw new Error('Không đủ hàng tồn kho');
        }

        // Get product price
        const product = await trx('SALES_PRODUCT')
            .where('SALES_PRODUCT_ID', productId)
            .first();

        const totalPrice = product.SALES_PRODUCT_PRICE * quantity;

        // Create receipt
        const [receiptResult] = await trx('RECEIPT').insert({
            BRANCH_ID: branchId,
            CUSTOMER_ID: customerId,
            RECEPTIONIST_ID: employeeId,
            RECEIPT_CREATED_DATE: new Date(),
            RECEIPT_TOTAL_PRICE: totalPrice,
            RECEIPT_PAYMENT_METHOD: paymentMethod,
            RECEIPT_STATUS: 'Đã hoàn thành'
        }).returning('RECEIPT_ID');

        const receiptId = receiptResult?.RECEIPT_ID || receiptResult;

        // Add receipt detail
        await trx('RECEIPT_DETAIL').insert({
            RECEIPT_ITEM_ID: 1,
            RECEIPT_ID: receiptId,
            PRODUCT_ID: productId,
            RECEIPT_ITEM_AMOUNT: quantity,
            RECEIPT_ITEM_PRICE: product.SALES_PRODUCT_PRICE
        });

        // Deduct stock
        await trx('BRANCH_STOCK')
            .where({ BRANCH_ID: branchId, SALES_PRODUCT_ID: productId })
            .decrement('QUANTITY', quantity);

        // Update customer spending
        const year = new Date().getFullYear();
        const existingSpending = await trx('CUSTOMER_SPENDING')
            .where({ CUSTOMER_ID: customerId, YEAR: year })
            .first();

        if (existingSpending) {
            await trx('CUSTOMER_SPENDING')
                .where({ CUSTOMER_ID: customerId, YEAR: year })
                .increment('MONEY_SPENT', totalPrice);
        } else {
            await trx('CUSTOMER_SPENDING').insert({
                CUSTOMER_ID: customerId,
                YEAR: year,
                MONEY_SPENT: totalPrice
            });
        }

        return receiptId;
    });
}
