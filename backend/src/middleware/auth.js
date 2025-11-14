import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 30,
	standardHeaders: true,
	legacyHeaders: false
});

export const requireAuth = (req, res, next) => {
	if (req.session?.isAuthenticated) return next();
	return res.status(401).json({ error: 'Unauthorized' });
};

export const sessionMiddleware = (req, _res, next) => {
	next();
};


