// ============================
// Central router. server.js mounts this once at /api.
// ============================

const express = require('express');
const router  = express.Router();

router.use('/auth',       require('./auth'));
router.use('/painters',   require('./painters'));
router.use('/bookings',   require('./bookings'));
router.use('/reviews',    require('./reviews'));
router.use('/quotes',     require('./quotes'));
router.use('/contracts',  require('./contracts'));
router.use('/milestones', require('./milestones'));
router.use('/payments',   require('./payments'));
router.use('/uploads',    require('./uploads'));
router.use('/admin',      require('./admin'));
router.use('/paint-volume', require('./paint-volume'));

module.exports = router;
