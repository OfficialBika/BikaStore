// models/Order.js — Game Item Order Schema

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema( { userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, gameId: { type: String, required: true }, itemCode: { type: String, required: true }, itemName: { type: String }, quantity: { type: Number, default: 1 }, price: { type: Number, required: true },

paymentMethod: { type: String }, // 'kpay' or 'wavepay'
proofFileId: { type: String },
isPaid: { type: Boolean, default: false },
isDelivered: { type: Boolean, default: false },
status: { type: String, enum: ["pending", "paid", "delivered", "cancelled"], default: "pending" },

note: String,

}, { timestamps: true } );

module.exports = mongoose.model("Order", orderSchema);
