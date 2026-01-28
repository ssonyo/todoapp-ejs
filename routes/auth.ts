// api about login

import express from 'express';
import passport from 'passport';

const router = express.Router();

// [GET] /auth/login
router.get('/login', (req, res) => {
    res.render('login.ejs');
});

// [POST] /auth/login
router.post('/login', passport.authenticate('local', {
    successRedirect: '/post/list', 
    failureRedirect: '/auth/login',
}));

// [GET] /auth/logout
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/auth/login');
    });
});

export default router;