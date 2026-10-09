Pod::Spec.new do |s|
  s.name           = 'QuitarFondo'
  s.version        = '1.0.0'
  s.summary        = 'Quita el fondo de una foto (Apple Vision) y lo deja blanco'
  s.description    = 'Módulo local de Fredce Campo: segmentación del sujeto con VNGenerateForegroundInstanceMaskRequest (iOS 17+).'
  s.author         = 'Fredce'
  s.homepage       = 'https://control.fredce.com'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,swift}'
end
