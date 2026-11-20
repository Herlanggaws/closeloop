#
# To learn more about a Podspec see http://guides.cocoapods.org/syntax/podspec.html.
# Run `pod lib lint closeloop.podspec` to validate before publishing.
#
Pod::Spec.new do |s|
  s.name             = 'closeloop'
  s.version          = '0.1.0'
  s.summary          = 'Saidloop for Flutter: forwards to the native iOS SDK.'
  s.description      = <<-DESC
Saidloop for Flutter: forwards to the native iOS SDK.
                       DESC
  s.homepage         = 'https://github.com/Herlanggaws/closeloop'
  s.license          = { :file => '../LICENSE' }
  s.author           = 'Saidloop'
  s.source           = { :path => '.' }
  s.source_files = 'Classes/**/*'
  s.dependency 'Flutter'
  s.dependency 'Saidloop', '0.1.0'
  s.platform = :ios, '15.0'

  # Flutter.framework does not contain a i386 slice.
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.swift_version = '5.9'

  # If your plugin requires a privacy manifest, for example if it uses any
  # required reason APIs, update the PrivacyInfo.xcprivacy file to describe your
  # plugin's privacy impact, and then uncomment this line. For more information,
  # see https://developer.apple.com/documentation/bundleresources/privacy_manifest_files
  # s.resource_bundles = {'closeloop_privacy' => ['Resources/PrivacyInfo.xcprivacy']}
end
