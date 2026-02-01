// utils/time.js — Time Utilities for Display

const moment = require("moment-timezone");
const { TZ } = require("../config/env");

/**
 * Return current date in readable format like "Feb 1, 2026"
 */
function nowDateText() {
  return moment().tz(TZ).format("MMM D, YYYY");
}

/**
 * Return formatted uptime duration from process start
 */
function uptimeText() {
  const uptime = process.uptime(); // in seconds
  const dur = moment.duration(uptime, "seconds");
  const parts = [];

  const days = dur.days();
  const hours = dur.hours();
  const mins = dur.minutes();

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${dur.seconds()}s`);

  return parts.join(" ");
}

module.exports = {
  nowDateText,
  uptimeText,
};
