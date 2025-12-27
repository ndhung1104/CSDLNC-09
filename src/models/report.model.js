import db from '../utils/db.js';

// Get branch daily report - Use Case 5
// Filter by branch AND date
export async function getBranchDailyReport({ branchId, reportDate }) {
    try {
        const useBranch = branchId != null;
        const receiptDateFilter = 'CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)';
        const receiptBranchFilter = useBranch ? 'AND r.BRANCH_ID = ?' : '';
        const receiptParams = useBranch ? [reportDate, branchId] : [reportDate];

        // 1) Total Revenue for branch on specific date (or all branches)
        const revenueResult = await db.raw(`
            SELECT 
                ISNULL(SUM(r.RECEIPT_TOTAL_PRICE), 0) as TotalRevenue,
                COUNT(*) as ReceiptCount
            FROM RECEIPT r
            WHERE ${receiptDateFilter}
              AND r.RECEIPT_STATUS = N'Đã thanh toán'
            ${receiptBranchFilter}
        `, receiptParams);

        // 2) Employee performance for that date (receptionist receipts)
        const employeeParams = useBranch ? [reportDate, branchId, branchId] : [reportDate];
        const employeeResult = await db.raw(`
            SELECT
                e.EMPLOYEE_ID,
                e.EMPLOYEE_NAME,
                COUNT(r.RECEIPT_ID) as ReceiptCount
            FROM EMPLOYEE e
            LEFT JOIN RECEIPT r 
                ON r.RECEPTIONIST_ID = e.EMPLOYEE_ID
                AND CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)
                AND r.RECEIPT_STATUS = N'Đã thanh toán'
                ${useBranch ? 'AND r.BRANCH_ID = ?' : ''}
            WHERE 1 = 1
                ${useBranch ? 'AND e.BRANCH_ID = ?' : ''}
            GROUP BY e.EMPLOYEE_ID, e.EMPLOYEE_NAME
            ORDER BY ReceiptCount DESC
        `, employeeParams);

        // 3) Customer count for that date
        const customerResult = await db.raw(`
            SELECT 
                COUNT(DISTINCT r.CUSTOMER_ID) as TotalCustomers
            FROM RECEIPT r
            WHERE ${receiptDateFilter}
              AND r.RECEIPT_STATUS = N'Đã thanh toán'
            ${receiptBranchFilter}
        `, receiptParams);

        // 4) Visits count from checkups
        const visitParams = useBranch ? [reportDate, branchId] : [reportDate];
        const visitResult = await db.raw(`
            SELECT COUNT(*) as TotalVisits
            FROM CHECK_UP c
            JOIN EMPLOYEE e ON c.VET_ID = e.EMPLOYEE_ID
            WHERE CONVERT(DATE, c.FOLLOW_UP_VISIT) = CONVERT(DATE, ?)
            ${useBranch ? 'AND e.BRANCH_ID = ?' : ''}
        `, visitParams);

        // 5) Product revenue (sales products only)
        const productRevenueResult = await db.raw(`
            SELECT 
                ISNULL(SUM(rd.RECEIPT_ITEM_AMOUNT * rd.RECEIPT_ITEM_PRICE), 0) as TotalProductRevenue
            FROM RECEIPT_DETAIL rd
            JOIN RECEIPT r ON rd.RECEIPT_ID = r.RECEIPT_ID
            JOIN SALES_PRODUCT sp ON rd.PRODUCT_ID = sp.SALES_PRODUCT_ID
            WHERE ${receiptDateFilter}
              AND r.RECEIPT_STATUS = N'Đã thanh toán'
            ${receiptBranchFilter}
        `, receiptParams);

        const topProducts = await db.raw(`
            SELECT TOP 5
                p.PRODUCT_NAME as ProductName,
                SUM(rd.RECEIPT_ITEM_AMOUNT) as Quantity,
                SUM(rd.RECEIPT_ITEM_AMOUNT * rd.RECEIPT_ITEM_PRICE) as Revenue
            FROM RECEIPT_DETAIL rd
            JOIN RECEIPT r ON rd.RECEIPT_ID = r.RECEIPT_ID
            JOIN SALES_PRODUCT sp ON rd.PRODUCT_ID = sp.SALES_PRODUCT_ID
            JOIN PRODUCT p ON sp.SALES_PRODUCT_ID = p.PRODUCT_ID
            WHERE ${receiptDateFilter}
              AND r.RECEIPT_STATUS = N'Đã thanh toán'
            ${receiptBranchFilter}
            GROUP BY p.PRODUCT_NAME
            ORDER BY Revenue DESC
        `, receiptParams);

        // 6) Doctor revenue (filtered by date and branch, based on medical service fees)
        const doctorParams = useBranch ? [reportDate, branchId] : [reportDate];
        const doctorRevenue = await db.raw(`
            SELECT
                e.EMPLOYEE_ID as VetId,
                e.EMPLOYEE_NAME as VetName,
                ISNULL(SUM(ms.MEDICAL_SERVICE_FEE), 0) as TotalRevenue,
                COUNT(c.CHECK_UP_ID) as VisitCount
            FROM EMPLOYEE e
            LEFT JOIN CHECK_UP c
                ON c.VET_ID = e.EMPLOYEE_ID
                AND CONVERT(DATE, c.FOLLOW_UP_VISIT) = CONVERT(DATE, ?)
            LEFT JOIN MEDICAL_SERVICE ms ON c.MEDICAL_SERVICE = ms.MEDICAL_SERVICE_ID
            WHERE e.EMPLOYEE_POSITION = 'VET'
            ${useBranch ? 'AND e.BRANCH_ID = ?' : ''}
            GROUP BY e.EMPLOYEE_ID, e.EMPLOYEE_NAME
            ORDER BY TotalRevenue DESC
        `, doctorParams);

        // 7) Revenue all branches (only when not filtering by branch)
        let branchRevenue = [];
        if (!useBranch) {
            branchRevenue = await db.raw(`
                SELECT
                    b.BRANCH_ID as BranchId,
                    b.BRANCH_NAME as BranchName,
                    ISNULL(SUM(r.RECEIPT_TOTAL_PRICE), 0) as TotalRevenue,
                    COUNT(r.RECEIPT_ID) as ReceiptCount
                FROM BRANCH b
                LEFT JOIN RECEIPT r
                    ON r.BRANCH_ID = b.BRANCH_ID
                    AND CONVERT(DATE, r.RECEIPT_CREATED_DATE) = CONVERT(DATE, ?)
                    AND r.RECEIPT_STATUS = N'Đã thanh toán'
                GROUP BY b.BRANCH_ID, b.BRANCH_NAME
                ORDER BY b.BRANCH_ID
            `, [reportDate]);
        }

        return {
            revenue: revenueResult[0] || { TotalRevenue: 0, ReceiptCount: 0 },
            employeeStats: employeeResult || [],
            customerStats: {
                NewCustomers: customerResult[0]?.TotalCustomers || 0,
                ReturningCustomers: 0
            },
            visitStats: {
                TotalVisits: visitResult[0]?.TotalVisits || 0
            },
            productRevenue: {
                TotalProductRevenue: productRevenueResult[0]?.TotalProductRevenue || 0,
                TopProducts: topProducts || []
            },
            doctorRevenue: doctorRevenue || [],
            branchRevenue
        };
    } catch (err) {
        console.error('DAILY REPORT ERROR:', err);
        return {
            revenue: { TotalRevenue: 0, ReceiptCount: 0 },
            employeeStats: [],
            customerStats: { NewCustomers: 0, ReturningCustomers: 0 },
            visitStats: { TotalVisits: 0 },
            productRevenue: { TotalProductRevenue: 0, TopProducts: [] },
            doctorRevenue: [],
            branchRevenue: []
        };
    }
}

// Get available dates (simplified)
export async function getAvailableDates({ branchId }) {
    return [];
}

// Run yearly membership review - Use Case 6
export async function runYearlyMembershipReview({ year }) {
    try {
        // 1. Get customers with spending from CUSTOMER_SPENDING and current rank
        const customers = await db.raw(`
            SELECT 
                c.CUSTOMER_ID,
                c.CUSTOMER_NAME,
                c.MEMBERSHIP_RANK_ID as CurrentRankId,
                cr.MEMBERSHIP_RANK_NAME as CurrentRankName,
                ISNULL(cs.MONEY_SPENT, 0) as MONEY_SPENT
            FROM CUSTOMER c
            LEFT JOIN CUSTOMER_SPENDING cs 
                ON cs.CUSTOMER_ID = c.CUSTOMER_ID AND cs.YEAR = ?
            LEFT JOIN MEMBERSHIP_RANK cr 
                ON cr.MEMBERSHIP_RANK_ID = c.MEMBERSHIP_RANK_ID
        `, [year]);

        // 2. Get rank thresholds (ordered by threshold DESC so highest rank first)
        const ranks = await db.raw(`
            SELECT 
                MEMBERSHIP_RANK_ID as id, 
                MEMBERSHIP_RANK_NAME as name, 
                MEMBERSHIP_RANK_UPGRADE_CONDITION as threshold
            FROM MEMBERSHIP_RANK
            ORDER BY MEMBERSHIP_RANK_UPGRADE_CONDITION DESC
        `);

        // 3. Classify customers
        let upgrades = [], downgrades = [], maintained = [];

        for (const c of customers) {
            // Find new rank based on spending (first rank where spending >= threshold)
            const newRank = ranks.find(r => c.MONEY_SPENT >= (r.threshold || 0)) || ranks[ranks.length - 1];

            const customer = {
                CUSTOMER_ID: c.CUSTOMER_ID,
                CUSTOMER_NAME: c.CUSTOMER_NAME,
                MEMBERSHIP_RANK_NAME: c.CurrentRankName,
                NewRank: newRank.name,
                MONEY_SPENT: c.MONEY_SPENT,
                newRankId: newRank.id
            };

            if (newRank.id > c.CurrentRankId) {
                upgrades.push(customer);
            } else if (newRank.id < c.CurrentRankId) {
                downgrades.push(customer);
            } else {
                maintained.push(customer);
            }
        }

        // 4. Update customer ranks for those who changed
        for (const c of [...upgrades, ...downgrades]) {
            await db.raw(`
                UPDATE CUSTOMER 
                SET MEMBERSHIP_RANK_ID = ? 
                WHERE CUSTOMER_ID = ?
            `, [c.newRankId, c.CUSTOMER_ID]);
        }

        return {
            upgrades,
            downgrades,
            maintained,
            summary: {
                totalUpgrades: upgrades.length,
                totalDowngrades: downgrades.length,
                totalMaintained: maintained.length
            }
        };
    } catch (err) {
        console.error('MEMBERSHIP REVIEW ERROR:', err);
        return {
            upgrades: [],
            downgrades: [],
            maintained: [],
            summary: { totalUpgrades: 0, totalDowngrades: 0, totalMaintained: 0 }
        };
    }
}

// Get branches for report selector
export async function getBranches() {
    const result = await db.raw('SELECT BRANCH_ID as id, BRANCH_NAME as name FROM BRANCH');
    return result;
}
