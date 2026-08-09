"use client";

const DEVICE_KEY = "mindscroll_device_id";

export function getDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const deviceId = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
}
