Pod::Spec.new do |s|
  s.name         = 'Saidloop'
  s.version      = '0.1.0'
  s.summary      = 'Saidloop report sheet for iOS: shake to report, masked screenshots, offline queue.'
  s.homepage     = 'https://github.com/Herlanggaws/closeloop'
  s.license      = { :type => 'Proprietary' }
  s.author       = 'Saidloop'
  s.source       = { :git => 'https://github.com/Herlanggaws/closeloop.git', :tag => "ios-v#{s.version}" }
  s.platform     = :ios, '15.0'
  s.swift_version = '5.9'
  # CocoaPods ships both SwiftPM targets as one module named Saidloop.
  s.source_files = 'Sources/SaidloopCore/**/*.swift', 'Sources/Saidloop/**/*.swift'
  s.frameworks   = 'UIKit', 'CoreMotion', 'Network'
end
