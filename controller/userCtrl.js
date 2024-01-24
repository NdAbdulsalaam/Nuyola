const user = require('../models/userModel');

const createUser = async (req, res) => {
    const email = req.body.email;
    const findUser = await user.findOne({ email: email });
    if (!findUser) {
        // create a new user
        const newUser = user.create(req.body);
        res.json(newUser)

    } else{
        // User already exist
        res.json({
            message: "User already exist",
            success: false
        })
    }
}

module.exports = { createUser }