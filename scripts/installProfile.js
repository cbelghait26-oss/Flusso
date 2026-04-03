const fs = require('fs');
const os = require('os');
const path = require('path');

// Only run on macOS (EAS build machine)
if (process.platform !== 'darwin') {
  console.log('Not macOS — skipping profile installation.');
  process.exit(0);
}

const profileDir = path.join(os.homedir(), 'Library', 'MobileDevice', 'Provisioning Profiles');
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

const b64 = process.env.FOCUS_LIVE_ACTIVITY_PROFILE;
if (!b64) {
  // Fall back to copying from repo if secret not set
  const src = path.join(__dirname, '..', 'credentials', 'ios', 'FocusLiveActivity_AdHoc.mobileprovision');
  if (fs.existsSync(src)) {
    const dest = path.join(profileDir, 'FocusLiveActivity_AdHoc.mobileprovision');
    fs.copyFileSync(src, dest);
    console.log('FocusLiveActivity profile installed from repo to', dest);
  } else {
    console.error('No profile source found — skipping.');
  }
  process.exit(0);
}

const profilePath = path.join(profileDir, 'FocusLiveActivity_AdHoc.mobileprovision');
fs.writeFileSync(profilePath, Buffer.from(b64, 'base64'));
console.log('FocusLiveActivity provisioning profile installed to', profilePath);
