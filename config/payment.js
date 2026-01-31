// config/payments.js — KPay / WavePay Payment Setup via ENV

const {
  KPAY_NAME,
  KPAY_PHONE,
  WAVEPAY_NAME,
  WAVEPAY_PHONE,
} = require("./env");

const PAYMENTS = {
  kpay: {
    name: KPAY_NAME,
    qr: "https://your-host.com/qrcodes/kpay.jpg", // replace with real URL
    accountNumber: KPAY_PHONE,
  },
  wavepay: {
    name: WAVEPAY_NAME,
    qr: "https://your-host.com/qrcodes/wavepay.jpg", // replace with real URL
    accountNumber: WAVEPAY_PHONE,
  },
};

module.exports = {
  PAYMENTS,
};
