require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "closeloop-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/Herlanggaws/closeloop"
  s.license      = { :type => "Proprietary" }
  s.author       = "Saidloop"
  s.source       = { :git => "https://github.com/Herlanggaws/closeloop.git", :tag => "react-native-v#{s.version}" }
  s.platforms    = { :ios => "15.0" }
  s.swift_version = "5.9"
  s.source_files = "ios/**/*.{h,m,swift}"
  s.dependency "React-Core"
  s.dependency "Saidloop", "0.1.0"
end
