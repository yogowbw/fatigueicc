class DeviceHealthCache {
  constructor() {
    this.snapshot = null;
  }

  set(snapshot) {
    this.snapshot = snapshot;
  }

  get() {
    return this.snapshot;
  }
}

const deviceHealthCache = new DeviceHealthCache();

module.exports = { DeviceHealthCache, deviceHealthCache };
