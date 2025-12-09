import { Router } from 'express';
import { requireRole } from '../middleware/auth.middleware.js';
import * as reportModel from '../models/report.model.js';

const router = Router();

// Daily report - MGR and DIRECTOR only
router.get('/daily', requireRole('MGR', 'DIRECTOR'), async (req, res) => {
    const { date } = req.query;
    const emp = req.session.employee;
    let branches = [];
    let report = null;

    try {
        branches = await reportModel.getBranches();

        if (date) {
            report = await reportModel.getBranchDailyReport({
                branchId: emp.branchId,
                reportDate: date
            });
        }
    } catch (err) {
        console.error(err);
    }

    res.render('reports/daily', {
        title: 'Báo cáo cuối ngày',
        report,
        branches,
        selectedDate: date || new Date().toISOString().split('T')[0],
        error: null,
        employee: emp
    });
});

// POST to generate daily report
router.post('/daily', requireRole('MGR', 'DIRECTOR'), async (req, res) => {
    const { date, branchId } = req.body;
    const emp = req.session.employee;

    console.log('=== ROUTE DEBUG ===');
    console.log('req.body:', req.body);
    console.log('branchId from body:', branchId);
    console.log('emp.branchId:', emp.branchId);

    const branches = await reportModel.getBranches();
    console.log('branches:', branches);
    console.log('branches is array:', Array.isArray(branches));

    const selectedBranchId = parseInt(branchId) || emp.branchId;
    console.log('selectedBranchId:', selectedBranchId);

    try {
        const report = await reportModel.getBranchDailyReport({
            branchId: selectedBranchId,
            reportDate: date
        });

        console.log('report:', JSON.stringify(report).substring(0, 500));
        console.log('=== END ROUTE DEBUG ===');

        // Also fetch available dates with data for this branch
        const availableDates = await reportModel.getAvailableDates({ branchId: selectedBranchId });

        res.render('reports/daily', {
            title: 'Báo cáo cuối ngày',
            report,
            branches,
            availableDates,
            selectedDate: date,
            selectedBranchId,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error('POST /daily error:', err);
        res.render('reports/daily', {
            title: 'Báo cáo cuối ngày',
            report: null,
            branches,
            availableDates: [],
            selectedDate: date,
            selectedBranchId,
            error: err.message,
            employee: emp
        });
    }
});

// Yearly membership review - DIRECTOR only
router.get('/membership-review', requireRole('DIRECTOR'), async (req, res) => {
    res.render('reports/membership', {
        title: 'Xét hạng hội viên cuối năm',
        result: null,
        selectedYear: new Date().getFullYear(),
        error: null,
        employee: req.session.employee
    });
});

// POST to run yearly membership review
router.post('/membership-review', requireRole('DIRECTOR'), async (req, res) => {
    const { year } = req.body;
    const emp = req.session.employee;

    try {
        const result = await reportModel.runYearlyMembershipReview({ year: parseInt(year) });
        res.render('reports/membership', {
            title: 'Xét hạng hội viên cuối năm',
            result,
            selectedYear: year,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error(err);
        res.render('reports/membership', {
            title: 'Xét hạng hội viên cuối năm',
            result: null,
            selectedYear: year,
            error: err.message,
            employee: emp
        });
    }
});

export default router;
