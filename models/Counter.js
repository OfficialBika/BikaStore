// models/Counter.js — For Order Number Auto-Increment

const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 1000 },
});

module.exports = {
  Counter: mongoose.model("Counter", counterSchema),
};
