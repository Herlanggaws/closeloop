require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "saidloop-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/XERV-Project/saidloop-react-native"
  s.license      = { :type => "MIT", :file => "LICENSE" }
  s.author       = "XERV Project"
  s.source       = { :git => "https://github.com/XERV-Project/saidloop-react-native.git", :tag => s.version.to_s }
  s.platforms    = { :ios => "15.0" }
  s.swift_version = "5.9"
  s.source_files = "ios/**/*.{h,m,swift}"
  s.dependency "React-Core"
  s.dependency "Saidloop", "0.1.0"
end
