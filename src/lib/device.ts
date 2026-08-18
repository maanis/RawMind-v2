"use client";

const DEVICE_KEY = "rawmind_device_id";

const makeDeviceId = () => {
  const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: () => string } | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function getDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const deviceId = makeDeviceId();
  window.localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
}
