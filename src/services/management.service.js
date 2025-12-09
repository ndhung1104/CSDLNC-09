import db from '../utils/db.js';

export async function getManagementDashboardData(branchId = null) {
    const today = new Date().toISOString().split('T')[0];

    // 1. Daily Revenue (Completed receipts today)
    let revenueQuery = db('RECEIPT')
        .whereRaw("CONVERT(date, RECEIPT_CREATED_DATE) = ?", [today])
        .where('RECEIPT_STATUS', 'Đã hoàn thành');

    if (branchId) {
        revenueQuery = revenueQuery.where('BRANCH_ID', branchId);
    }

    const revenueResult = await revenueQuery.sum('RECEIPT_TOTAL_PRICE as total').first();
    const dailyRevenue = revenueResult?.total || 0;

    // 2. Receipts Count
    let receiptCountQuery = db('RECEIPT')
        .whereRaw("CONVERT(date, RECEIPT_CREATED_DATE) = ?", [today])
        .where('RECEIPT_STATUS', 'Đã hoàn thành');

    if (branchId) {
        receiptCountQuery = receiptCountQuery.where('BRANCH_ID', branchId);
    }
    const receiptCount = (await receiptCountQuery.count('* as count').first())?.count || 0;

    // 3. Employee Performance (Top 5 by Invoice Count Today)
    let empQuery = db('RECEIPT')
        .join('EMPLOYEE', 'RECEIPT.RECEPTIONIST_ID', 'EMPLOYEE.EMPLOYEE_ID')
        .select('EMPLOYEE.EMPLOYEE_NAME as name')
        .count('RECEIPT.RECEIPT_ID as count')
        .whereRaw("CONVERT(date, RECEIPT.RECEIPT_CREATED_DATE) = ?", [today])
        .where('RECEIPT.RECEIPT_STATUS', 'Đã hoàn thành')
        .groupBy('EMPLOYEE.EMPLOYEE_NAME')
        .orderBy('count', 'desc')
        .limit(5);

    if (branchId) {
        empQuery = empQuery.where('RECEIPT.BRANCH_ID', branchId);
    }
    const employeePerformance = await empQuery;

    // 4. Service Breakdown (Revenue by Service Type - simplified as Product vs Service not strictly separated in Receipt Detail without complex join)
    // For now, let's just count receipt items by product name
    let serviceStatsQuery = db('RECEIPT_DETAIL')
        .join('RECEIPT', 'RECEIPT_DETAIL.RECEIPT_ID', 'RECEIPT.RECEIPT_ID')
        .join('PRODUCT', 'RECEIPT_DETAIL.PRODUCT_ID', 'PRODUCT.PRODUCT_ID')
        .select('PRODUCT.PRODUCT_NAME as name')
        .sum('RECEIPT_DETAIL.RECEIPT_ITEM_AMOUNT as value')
        .whereRaw("CONVERT(date, RECEIPT.RECEIPT_CREATED_DATE) = ?", [today])
        .groupBy('PRODUCT.PRODUCT_NAME')
        .orderBy('value', 'desc')
        .limit(5);

    if (branchId) {
        serviceStatsQuery = serviceStatsQuery.where('RECEIPT.BRANCH_ID', branchId);
    }
    const serviceStats = await serviceStatsQuery;

    // 5. Monthly Revenue by Branch (For Use Case 6)
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = await db('RECEIPT')
        .join('BRANCH', 'RECEIPT.BRANCH_ID', 'BRANCH.BRANCH_ID')
        .select(
            'BRANCH.BRANCH_NAME as branch',
            db.raw('MONTH(RECEIPT_CREATED_DATE) as month'),
            db.raw('SUM(RECEIPT_TOTAL_PRICE) as total')
        )
        .whereRaw('YEAR(RECEIPT_CREATED_DATE) = ?', [currentYear])
        .where('RECEIPT_STATUS', 'Đã hoàn thành')
        .groupBy('BRANCH.BRANCH_NAME', db.raw('MONTH(RECEIPT_CREATED_DATE)'))
        .orderBy('branch', 'asc')
        .orderBy('month', 'asc');

    return {
        dailyRevenue,
        receiptCount,
        employeePerformance,
        serviceStats,
        monthlyRevenue
    };
}

export async function getManagementCustomersData(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const customers = await db('CUSTOMER')
        .join('MEMBERSHIP_RANK', 'CUSTOMER.MEMBERSHIP_RANK_ID', 'MEMBERSHIP_RANK.MEMBERSHIP_RANK_ID')
        .select(
            'CUSTOMER.CUSTOMER_ID as id',
            'CUSTOMER.CUSTOMER_NAME as name',
            'CUSTOMER.CUSTOMER_EMAIL as email',
            'CUSTOMER.CUSTOMER_LOYALTY as loyalty',
            'MEMBERSHIP_RANK.MEMBERSHIP_RANK_NAME as rank',
            db.raw("(SELECT SUM(MONEY_SPENT) FROM CUSTOMER_SPENDING WHERE CUSTOMER_ID = CUSTOMER.CUSTOMER_ID AND YEAR = YEAR(GETDATE())) as yearlySpent")
        )
        .orderBy('yearlySpent', 'desc')
        .offset(offset)
        .limit(limit);

    const total = (await db('CUSTOMER').count('* as count').first())?.count || 0;

    return {
        customers,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
}

export async function processYearEnd() {
    const currentYear = new Date().getFullYear();
    // Assuming we process based on the spending of the CURRENT year to determine rank for NEXT year
    // Or we strictly follow the requirement: "Year-end processing" -> review current year spending.

    const ranks = await db('MEMBERSHIP_RANK').orderBy('MEMBERSHIP_RANK_UPGRADE_CONDITION', 'asc');
    const customers = await db('CUSTOMER')
        .select('CUSTOMER_ID', 'MEMBERSHIP_RANK_ID')
        .orderBy('CUSTOMER_ID');

    const results = {
        upgraded: 0,
        downgraded: 0,
        maintained: 0,
        total: customers.length
    };

    await db.transaction(async (trx) => {
        for (const customer of customers) {
            // Get total spending for current year
            const spendingRecord = await trx('CUSTOMER_SPENDING')
                .where({ CUSTOMER_ID: customer.CUSTOMER_ID, YEAR: currentYear })
                .first();

            const moneySpent = spendingRecord ? spendingRecord.MONEY_SPENT : 0;
            const currentRank = ranks.find(r => r.MEMBERSHIP_RANK_ID === customer.MEMBERSHIP_RANK_ID);

            // Logic to find new rank
            // We find the highest rank where moneySpent >= UPGRADE_CONDITION
            // Actually, usually it's: if >= upgrade condition of Next Level -> Upgrade
            // But let's look at the ranks list. It's sorted by upgrade condition ASC.
            // Example: Basic (0), Silver (10M), Gold (50M), VIP (100M).

            let newRankId = customer.MEMBERSHIP_RANK_ID; // Default maintain
            let action = 'maintained';

            // Find the candidate rank based on spending
            // The logic: You qualify for a rank if you met its upgrade condition.
            // We pick the highest rank that the user qualifies for.
            const qualifiedRank = [...ranks].reverse().find(r => moneySpent >= r.MEMBERSHIP_RANK_UPGRADE_CONDITION);

            if (qualifiedRank) {
                if (qualifiedRank.MEMBERSHIP_RANK_ID !== customer.MEMBERSHIP_RANK_ID) {
                    if (qualifiedRank.MEMBERSHIP_RANK_UPGRADE_CONDITION > currentRank.MEMBERSHIP_RANK_UPGRADE_CONDITION) {
                        newRankId = qualifiedRank.MEMBERSHIP_RANK_ID;
                        action = 'upgraded';
                    } else if (moneySpent < currentRank.MEMBERSHIP_RANK_MAINTAIN_THRESHOLD) {
                        // Downgrade logic: If didn't maintain current, drop to the qualified one (or lower)
                        newRankId = qualifiedRank.MEMBERSHIP_RANK_ID;
                        action = 'downgraded';
                    }
                } else {
                    // Same rank, check maintain threshold
                    if (moneySpent < currentRank.MEMBERSHIP_RANK_MAINTAIN_THRESHOLD) {
                        // Downgrade to one level below? Or to the level they actually qualify for?
                        // Let's assume downgrade to the one below if exists, or just recalc based on spending.
                        // "List by spending" approach is safer.
                        // If they are Gold but spent 0, they should drop to Basic.
                        // qualifiedRank logic above handles this if "Basic" has condition 0.
                        // But wait, "Upgrade Condition" usually implies "Min spending to GET there".
                        // "Maintain Threshold" is usually lower than Upgrade.

                        // Strict interpretation of requirements:
                        // Case 1 (Maintain): Spent >= Maintain Threshold -> Keep.
                        // Case 2 (Downgrade): Spent < Maintain -> Drop? To what? Usually 1 level or recalc.
                        // Case 3 (Upgrade): Spent >= Upgrade Condition -> Upgrade.

                        // Let's simplify: Set rank = highest rank where Spent >= UpgradeCondition.
                        // UNLESS Current Rank's Maintain Threshold is met?
                        // Actually, purely based on spending is easiest and fair.

                        // BUT, the requirement distinguishes Keep vs Downgrade.
                        // If I am VIP (Upgrade 100M), Maintain 80M. I spent 90M.
                        // Upgrade Condition for VIP is 100M? No, that's to BECOME VIP.
                        // So if I am VIP, I stay VIP if > 80M.

                        // Let's use this logic:
                        // 1. Check Upgrade: Can I go higher? (Spent >= NextRank.Upgrade)
                        // 2. Check Maintain: Can I stay? (Spent >= CurrentRank.Maintain)
                        // 3. Else: Downgrade (To immediately lower rank? Or calculate?)
                    }
                }
            } else {
                // Qualified for nothing? (Spent 0). Should be lowest rank.
                const lowestRank = ranks[0];
                if (customer.MEMBERSHIP_RANK_ID !== lowestRank.MEMBERSHIP_RANK_ID) {
                    newRankId = lowestRank.MEMBERSHIP_RANK_ID;
                    action = 'downgraded';
                }
            }

            // Note: The Requirement says "System compares... with current rank's threshold".

            // Let's refine based on Requirement Text:
            // Case 3 (Upgrade): Sum > Upgrade Condition -> Upgrade.
            // Case 1 (Keep): Sum >= Maintain Threshold -> Keep.
            // Case 2 (Downgrade): Sum < Maintain Threshold -> Downgrade.

            let finalRankId = customer.MEMBERSHIP_RANK_ID;

            // Check Upgrade first (Priority)
            // Find all ranks higher than current
            const higherRanks = ranks.filter(r => r.MEMBERSHIP_RANK_UPGRADE_CONDITION > currentRank.MEMBERSHIP_RANK_UPGRADE_CONDITION);
            const upgradeTarget = [...higherRanks].reverse().find(r => moneySpent >= r.MEMBERSHIP_RANK_UPGRADE_CONDITION);

            if (upgradeTarget) {
                finalRankId = upgradeTarget.MEMBERSHIP_RANK_ID;
                results.upgraded++;
            } else {
                // Not upgrading. Check maintain.
                if (moneySpent >= currentRank.MEMBERSHIP_RANK_MAINTAIN_THRESHOLD) {
                    finalRankId = customer.MEMBERSHIP_RANK_ID; // Maintain
                    results.maintained++;
                } else {
                    // Downgrade
                    // To what? "Adjust rank to lower level". Let's drop 1 level.
                    const lowerRanks = ranks.filter(r => r.MEMBERSHIP_RANK_UPGRADE_CONDITION < currentRank.MEMBERSHIP_RANK_UPGRADE_CONDITION);
                    if (lowerRanks.length > 0) {
                        // Get the highest of the lower ranks (immediate predecessor)
                        finalRankId = lowerRanks[lowerRanks.length - 1].MEMBERSHIP_RANK_ID;
                        results.downgraded++;
                    } else {
                        // Already lowest
                        finalRankId = customer.MEMBERSHIP_RANK_ID;
                        results.maintained++;
                    }
                }
            }

            if (finalRankId !== customer.MEMBERSHIP_RANK_ID) {
                await trx('CUSTOMER')
                    .where('CUSTOMER_ID', customer.CUSTOMER_ID)
                    .update({ MEMBERSHIP_RANK_ID: finalRankId });
            }

            // Initialize spending for NEXT year
            const nextYear = currentYear + 1;
            const exists = await trx('CUSTOMER_SPENDING')
                .where({ CUSTOMER_ID: customer.CUSTOMER_ID, YEAR: nextYear })
                .first();

            if (!exists) {
                await trx('CUSTOMER_SPENDING').insert({
                    CUSTOMER_ID: customer.CUSTOMER_ID,
                    YEAR: nextYear,
                    MONEY_SPENT: 0
                });
            }
        }
    });

    return results;
}
