#!/bin/bash
npx expo prebuild --clean
python3 -c "
import plistlib, glob
files = glob.glob('ios/*/Info.plist')
for f in files:
    print('Patching', f)
    data = plistlib.load(open(f, 'rb'))
    data.pop('UIBackgroundModes', None)
    plistlib.dump(data, open(f, 'wb'))
print('Done - UIBackgroundModes removed')
"
