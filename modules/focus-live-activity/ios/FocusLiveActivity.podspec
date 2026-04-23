require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'FocusLiveActivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '16.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # ActivityKit is a system framework required by FocusLiveActivityManager and
  # FocusLiveActivityModule. Declaring it here ensures CocoaPods links it even
  # when Xcode's automatic framework linkage doesn't pick it up.
  s.frameworks = 'ActivityKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Only compile the main-target sources; the widget/ directory
  # is a separate Xcode extension target and must NOT be included here.
  s.source_files = '*.{h,m,swift}'
end
