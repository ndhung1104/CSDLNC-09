import { Router } from 'express';
import * as employeeModel from '../models/employee.model.js';

const router = Router();

router.get('/login', (req, res) => {
    if (req.session.employee) return res.redirect('/dashboard');
    res.render('auth/login', { title: 'Đăng nhập', email: '', error: null });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const emp = await employeeModel.findByEmail(email);
        if (!emp) {
            return res.render('auth/login', { title: 'Đăng nhập', email, error: 'Email không tồn tại' });
        }
        if (emp.password.trim() !== password.trim()) {
            return res.render('auth/login', { title: 'Đăng nhập', email, error: 'Mật khẩu không đúng' });
        }
        req.session.employee = {
            id: emp.id, name: emp.name, email: emp.email,
            position: emp.position.trim(), branchId: emp.branchId, branchName: emp.branchName
        };
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        res.render('auth/login', { title: 'Đăng nhập', email, error: 'Lỗi hệ thống' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

export default router;
