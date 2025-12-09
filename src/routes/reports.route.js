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
    const branches = await reportModel.getBranches();

    try {
        const report = await reportModel.getBranchDailyReport({
            branchId: branchId || emp.branchId,
            reportDate: date
        });
        res.render('reports/daily', {
            title: 'Báo cáo cuối ngày',
            report,
            branches,
            selectedDate: date,
            error: null,
            employee: emp
        });
    } catch (err) {
        console.error(err);
        res.render('reports/daily', {
            title: 'Báo cáo cuối ngày',
            report: null,
            branches,
            selectedDate: date,
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
