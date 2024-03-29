const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const productModel = require('../models/productModel');
const userModel = require('../models/userModel');

const { generateToken } = require('../config/jwtToken');
const { generateRefreshToken } = require('../config/jwtRefreshToken');
const { validateMongoDbId } = require('../utils/validateMongoDbId');
const { sendEmail } = require('./emailCtrl');



const RegisterUser = asyncHandler(
    async (req, res) => {
        const { email, mobile } = req.body;
        const findEmail = await userModel.findOne({ email: email });
        const findMobile = await userModel.findOne({ mobile: mobile });

        if (!findEmail && !findMobile) {
            // create a new user
            const newUser = await userModel.create(req.body);
            res.json(newUser)
    
        } else if (findEmail) {
            // User already exist
           throw new Error('User Already Exist. This email has been used')
        } else {
            throw new Error('User Already Exist. This Mobile number has been used')
        }
    }
)

const loginUser = asyncHandler(
    async (req, res) => {
        const { email, password } = req.body;
        // Check if user exist
        const findUser = await userModel.findOne({ email });
        if (findUser && await findUser.checkPassword(password)) {
            const refreshToken = await generateRefreshToken(findUser._id)
            const updateUser = await userModel.findOneAndUpdate(
                findUser._id, {
                refreshToken: refreshToken,
            }, { new: true });
            res.cookie('refreshToken', refreshToken,{
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000
            });
                res.json({
                    _id: findUser._id,
                    firstname: findUser?.firstname,
                    lastname: findUser?.lastname,
                    email: findUser.email,
                    mobile: findUser?.mobile,
                    token: generateToken(findUser?._id)
        })
        } else {
            throw new Error("Invalid Credentials")
        }
    })

    const loginAdmin= asyncHandler(
        async (req, res) => {
            const { email, password } = req.body;
            // Check if user exist
            const findAdmin = await userModel.findOne({ email });
            if(findAdmin.role.toLocaleLowerCase() !== "admin") throw new Error("You're not authorized")
            if (findAdmin && await findAdmin.checkPassword(password)) {
                const refreshToken = await generateRefreshToken(findAdmin._id)
                const updateAdmin = await userModel.findOneAndUpdate(
                    findAdmin._id, {
                    refreshToken: refreshToken,
                }, { new: true });
                res.cookie('refreshToken', refreshToken,{
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000
                });
                    res.json({
                        _id: findAdmin._id,
                        firstname: findAdmin?.firstname,
                        lastname: findAdmin?.lastname,
                        email: findAdmin.email,
                        mobile: findAdmin?.mobile,
                        token: generateToken(findAdmin?._id)
            })
            } else {
                throw new Error("Invalid Credentials")
            }
        })

const logoutUser = asyncHandler(
    async (req, res) => {
        const { refreshToken } = req.cookies;
        if(!refreshToken) throw new Error("No refersh token found");
        const findUser = await userModel.findOne({ refreshToken });
        if(!findUser) {
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: true,
            });
            res.sendStatus(204) //forbidden
        } else {
            await userModel.findOneAndUpdate({refreshToken}, {
                refreshToken: "",
            }, { new: true });
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: true,
            });
            res.sendStatus(204);
        }
    });

const refreshToken = asyncHandler(
    async (req, res) => {
        const { refreshToken } = req.cookies;
        if(!refreshToken) throw new Error("No refresh token found. Please login!");
        const findUser = await userModel.findOne({ refreshToken });
        if(!findUser) throw new Error("User does not exist. Please sign-up");
        jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
            if(err || findUser.id !== decoded.id) {
                throw new Error("Refresh token not match user");
            } else {
                const accessToken = generateToken(findUser._id)
                res.json(accessToken)
            }
        })
    }
)

const getUser = asyncHandler(
    async (req, res) => {
        try {
            const { id } = req.params;
            validateMongoDbId(id)
            const getUser = await userModel.findById(id);
            res.json(getUser)
       } catch(error) {
            throw new Error(error)
       }
    });


const getUsers = asyncHandler(
    async (req, res) => {
       try {
            const getUsers = await userModel.find();
            res.json(getUsers)
       } catch(error){
            throw new Error(error)
       }
    });

const updateUser = asyncHandler(
    async (req, res) => {
        try{
            const currentUserId = req.user._id;
            validateMongoDbId(currentUserId)

            // const currentRole = req.user.role
            // let newRole = req.body?.role
            // if(currentRole === "admin" && newRole) {
            //     newRole = newRole;
            // } else {
            //     newRole = currentRole;
            // }

            const updateUser = await userModel.findByIdAndUpdate(
                currentUserId, 
            {
                firstname: req?.body?.firstname,
                lastname: req?.body?.lastname,
                email: req?.body?.email,
                mobile: req?.body?.mobile,
                role: req?.body?.role,
                address: req?.body?.address,
            }, { new: true })
            res.json(updateUser)
        } catch(error) {
            throw new Error(error)
        }
    }
)

const deleteUser = asyncHandler(
    async (req, res) => {
        try{
            const { _id } = req.user;
            validateMongoDbId(_id)
            const deleteUser = await userModel.findByIdAndDelete(_id)
            res.send(`User deleted successfully`)
        } catch(error) {
            throw new Error(error)
        }
    }
)

const updatePassword = asyncHandler(
    async (req, res) => {
        const { _id } = req.user;
        const { password } = req.body;
        validateMongoDbId(_id)
        const currentUser = await userModel.findById(_id);
        if(password) {
            currentUser.password =  password
            const updatePassword = await currentUser.save();
            res.json(updatePassword);
        }

    }
)

const forgotPassword = asyncHandler(
    async (req, res) => {
        const { email } = req.body;
        const currentUser = await userModel.findOne({ email });
        if(!currentUser) throw new Error("Email not registered. signup")
        
        if(currentUser) {
            try{
                const resetToken = await currentUser.generatePasswordResetToken();
                await currentUser.save() 
                const resetURL = `http://localhost:5000/user/password/reset/${resetToken}`
                const resetMessage =`Link valid for 24 hours. Please click <a href=${resetURL}>here</a> to reset password`
                const data = {
                    to: email,
                    subject: "Reset password",
                    html: resetMessage,
                };
                sendEmail(data);

                res.json(resetToken)                 
            } catch(error) {
                throw new Error(error)
            }
        }

    }
)

const resetPassword = asyncHandler(
    async (req, res) => {
        const { password } = req.body;
        const { token } = req.params;
        const hashedToken = crypto.createHash('sha256')
        .update(token).digest('hex')
        const currentUser = await userModel.findOne({ 
            passwordResetToken:hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });
        if(!currentUser) throw new Error("Reset token expired. Try again");
        currentUser.password = password;
        currentUser.passwordResetToken = undefined;
        currentUser.passwordResetExpires= undefined;
        await currentUser.save();
        res.json(currentUser);
    }
)

// Admin Only section
const blockUser = asyncHandler(
    async (req, res) => {
        const { _id } = req.user;
        validateMongoDbId(_id)
        try{
            const blockUser = await userModel.findByIdAndUpdate(_id, {
                isBlocked: true
            }, { new: true })
            res.send("User blocked!")
        } catch(error) {
            throw new Error(error)
        }
    }
)

const unblockUser = asyncHandler(
    async (req, res) => {
        const { _id } = req.user;
        validateMongoDbId(_id)
        try{
            const unblockUser = await userModel.findByIdAndUpdate(_id, {
                isBlocked: false
            }, { new: true })
            res.send("User unblocked!")
        } catch(error) {
            throw new Error(error)
        }
    }
)

const addToWishlist = asyncHandler(
    async (req, res) => {
        const productId = req.params.id;
        const currentProduct = await productModel.findById(productId);
        if(!currentProduct) throw new Error("Can't retrieve product. It is either deleted or doesn't exist");
        
        const currentUserId = req.user._id;
        if(!currentUserId) throw new Error("You're not in. You need to login to add/remove product to wishlist");
        try{
            const currentUser = await userModel.findById(currentUserId)
            const addedByUser = await currentUser.wishlist?.find((id) => id.toString() === productId.toString())
            if(addedByUser) {
                const currentUser = await userModel.findByIdAndUpdate(
                currentUserId,
                { 
                    $pull: {wishlist: productId},
                },
                { new:true }
            )
            res.json(currentUser)
            } else {
                const currentUser = await userModel.findByIdAndUpdate(
                    currentUserId,
                    { 
                        $push: {wishlist: productId},
                    },
                    { new:true }
                )
                res.json(currentUser)
            }
        } catch(error) {
            throw new Error(error)
        }
    }
)

const getWishlist = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user._id
        if(!currentUserId) throw new Error("You need to login")
        try{
            currentUser = await userModel.findById(currentUserId)
            res.json(currentUser.wishlist)
        } catch(error) {
            throw new Error(error)
        }
    }
)

// const updateAddress = asyncHandler(
//     async (req, res) => {
//         try{
//             const currentUserId = req.user._id;
//             validateMongoDbId(currentUserId)

//             const updateUser = await userModel.findByIdAndUpdate(
//                 currentUserId, 
//             {
//                 "address": req?.body?.address,
//             }, { new: true })
//             res.json(updateUser)
//         } catch(error) {
//             throw new Error(error)
//         }
//     }
// )

module.exports = {
    RegisterUser,
    loginUser,
    loginAdmin,
    refreshToken,
    logoutUser,
    getUser,
    getUsers,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
    updatePassword,
    forgotPassword,
    resetPassword,
    addToWishlist,
    getWishlist
}