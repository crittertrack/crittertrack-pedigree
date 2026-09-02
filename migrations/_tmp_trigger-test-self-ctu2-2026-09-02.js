require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { User } = require('../database/models');

const API_BASE = 'https://crittertrack-pedigree-production.up.railway.app/api';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' }).select('_id');
    const secret = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';
    const token = jwt.sign({ user: { id: user._id.toString() } }, secret, { expiresIn: '5m' });

    try {
        const res = await axios.post(`${API_BASE}/push/test-self`, {}, { headers: { Authorization: `Bearer ${token}` } });
        console.log(res.status, res.data);
    } catch (err) {
        console.log('Request failed:', err.response?.status, err.response?.data || err.message);
    }

    await mongoose.disconnect();
})();
