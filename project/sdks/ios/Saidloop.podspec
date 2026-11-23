Pod::Spec.new do |s|
  s.name          = 'Saidloop'
  s.version       = '0.1.0'
  s.summary       = 'In-app bug reports and feedback for iOS that your coding agent can fix via MCP.'
  s.description   = <<-DESC
    Saidloop adds a native report sheet to your iOS app: users shake the phone or you call
    Saidloop.show(), the screen is captured with sensitive views masked, and reports are
    queued offline and sent when the network is back.
  DESC
  s.homepage      = 'https://github.com/XERV-Project/saidloop-ios'
  s.license       = { :type => 'MIT', :file => 'LICENSE' }
  s.author        = 'Saidloop'
  s.source        = { :git => 'https://github.com/XERV-Project/saidloop-ios.git', :tag => s.version.to_s }
  s.platform      = :ios, '15.0'
  s.swift_version = '5.9'
  # CocoaPods ships both SwiftPM targets as one module named Saidloop.
  s.source_files  = 'Sources/SaidloopCore/**/*.swift', 'Sources/Saidloop/**/*.swift'
  s.frameworks    = 'UIKit', 'CoreMotion', 'Network'
end
