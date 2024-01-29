const express = require('express');
const router = express.Router();

const { authMiddleware, isAdmin } = require('../middlewares/authMidlleware');
const {
    createCoupon,
    // updateBrand,
    // deleteBrand,
    // getBrand,
    // getBrands,
} = require('../controller/couponCtrl');


router.post('/create', authMiddleware, isAdmin, createCoupon);
// router.get('/all', getBrands);
// router.put('/update/:id', authMiddleware, isAdmin, updateBrand);
// router.delete('/delete/:id', authMiddleware, isAdmin, deleteBrand);
// router.get('/:id', getBrand);



module.exports = router;