#
# Flutter plugin podspec. The name must match the pub package name.
# Run `pod lib lint saidloop_flutter.podspec` to validate.
#
Pod::Spec.new do |s|
  s.name             = 'saidloop_flutter'
  s.version          = '0.1.0'
  s.summary          = 'Saidloop for Flutter: forwards to the native iOS SDK.'
  s.description      = <<-DESC
Saidloop for Flutter: forwards to the native Saidloop iOS SDK.
                       DESC
  s.homepage         = 'https://github.com/XERV-Project/saidloop-flutter'
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

  # s.resource_bundles = {'saidloop_flutter_privacy' => ['Resources/PrivacyInfo.xcprivacy']}
end
