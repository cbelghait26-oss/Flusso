const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const profileDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

const b64 = process.env.FOCUS_LIVE_ACTIVITY_PROFILE;
if (!b64) {
  console.error('FOCUS_LIVE_ACTIVITY_PROFILE secret not set — skipping.');
  process.exit(0);
}

const profilePath = path.join(profileDir, 'FocusLiveActivity_AdHoc.mobileprovision');
fs.writeFileSync(profilePath, Buffer.from(b64, 'base64'));
console.log('FocusLiveActivity provisioning profile installed to', profilePath);
