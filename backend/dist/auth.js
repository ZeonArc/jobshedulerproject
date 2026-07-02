"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = exports.authMiddleware = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("./db");
const env_1 = require("./config/env");
const authRouter = (0, express_1.Router)();
exports.authRouter = authRouter;
const JWT_SECRET = env_1.config.JWT_SECRET;
// Middleware to protect API routes
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
};
exports.authMiddleware = authMiddleware;
// Registration Endpoint
authRouter.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password required' });
    try {
        const existing = await db_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(400).json({ error: 'Email already in use' });
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await db_1.prisma.user.create({
            data: { email, password: hashedPassword }
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Login Endpoint
authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt_1.default.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, email: user.email } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
